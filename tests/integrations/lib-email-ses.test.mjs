import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEmail, retryEmailLog, __setEmailProviderForTests } from "@/lib/email/ses";
import { __reset, __seed, prisma } from "../mocks/prisma.mjs";

function seedClient(clientId = "client-1") {
  __reset();
  __seed("wehowareClient", [{ id: clientId, name: "Acme" }]);
  return clientId;
}

test("sendEmail rejects missing clientId", async () => {
  await assert.rejects(
    () =>
      sendEmail({
        clientId: null,
        to: "x@y.com",
        template: "generic",
        context: { subject: "S", text: "T" },
      }),
    /clientId is required/
  );
});

test("sendEmail rejects bad recipient address", async () => {
  await assert.rejects(
    () =>
      sendEmail({
        clientId: "c1",
        to: "not-an-email",
        template: "generic",
      }),
    /valid email/
  );
});

test("sendEmail rejects unknown template", async () => {
  const clientId = seedClient();
  await assert.rejects(
    () =>
      sendEmail({
        clientId,
        to: "x@y.com",
        template: "nope.template",
      }),
    /Unknown email template/
  );
});

test("sendEmail in log mode marks as Sent without network calls", async () => {
  const clientId = seedClient();
  __setEmailProviderForTests(null, {
    mode: "log",
    fromAddress: "no-reply@test.local",
  });
  const res = await sendEmail({
    clientId,
    to: "alice@x.com",
    template: "generic",
    context: { subject: "Hi", text: "Body" },
  });
  assert.equal(res.status, "Sent");
  assert.match(res.providerMessageId, /^log:/);
  const logs = await prisma.wehowareEmailLog.findMany({ where: { clientId } });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, "Sent");
  assert.equal(logs[0].toAddress, "alice@x.com");
  assert.equal(logs[0].attemptCount, 1);
  assert.equal(logs[0].subject, "Hi");
});

test("sendEmail with injected SES client records providerMessageId on success", async () => {
  const clientId = seedClient();
  let captured;
  const fakeClient = {
    async send(command) {
      captured = command?.input;
      return { MessageId: "ses-msg-123" };
    },
  };
  __setEmailProviderForTests(fakeClient, {
    mode: "ses",
    fromAddress: "no-reply@test.local",
  });
  const res = await sendEmail({
    clientId,
    to: "bob@x.com",
    template: "generic",
    context: { subject: "S", text: "T" },
  });
  assert.equal(res.status, "Sent");
  assert.equal(res.providerMessageId, "ses-msg-123");
  assert.ok(captured, "SES client should have been invoked");
  __setEmailProviderForTests(null, null);
});

test("sendEmail flips log row to Failed when SES throws", async () => {
  const clientId = seedClient();
  const fakeClient = {
    async send() {
      throw new Error("network down");
    },
  };
  __setEmailProviderForTests(fakeClient, {
    mode: "ses",
    fromAddress: "no-reply@test.local",
  });
  await assert.rejects(
    () =>
      sendEmail({
        clientId,
        to: "carol@x.com",
        template: "generic",
        context: { subject: "S", text: "T" },
      }),
    /network down/
  );
  const logs = await prisma.wehowareEmailLog.findMany({ where: { clientId } });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, "Failed");
  assert.match(logs[0].errorMessage, /network down/);
  __setEmailProviderForTests(null, null);
});

test("retryEmailLog promotes Failed → Sent on success", async () => {
  const clientId = seedClient();
  // Pre-seed a Failed log row
  __seed("wehowareEmailLog", [
    {
      id: "log-1",
      clientId,
      toAddress: "x@y.com",
      fromAddress: "no-reply@test.local",
      subject: "S",
      template: "generic",
      bodyText: "T",
      bodyHtml: "<p>T</p>",
      status: "Failed",
      attemptCount: 1,
      errorMessage: "prev error",
    },
  ]);
  __setEmailProviderForTests(null, {
    mode: "log",
    fromAddress: "no-reply@test.local",
  });
  const updated = await retryEmailLog("log-1");
  assert.equal(updated.status, "Sent");
  assert.equal(updated.attemptCount, 2);
});

test("retryEmailLog suppresses after MAX_RETRY attempts", async () => {
  const clientId = seedClient();
  __seed("wehowareEmailLog", [
    {
      id: "log-2",
      clientId,
      toAddress: "x@y.com",
      fromAddress: "no-reply@test.local",
      subject: "S",
      template: "generic",
      status: "Failed",
      attemptCount: 3,
    },
  ]);
  const updated = await retryEmailLog("log-2");
  assert.equal(updated.status, "Suppressed");
});
