// src/lib/auth.js
// NextAuth v5 (Auth.js) configuration
// Strategy: JWT (stateless — no Session table in DB)
// Provider: Credentials (email + bcrypt password)

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ROLES_WITH_CLIENT_ACCESS = ["employee", "admin", "client"];

/**
 * Fetches the accessible clients for an employee/admin/client user.
 * Uses a single JOIN query — no N+1.
 */
async function getAccessibleClients(userId) {
  const rows = await prisma.wehowareUserClient.findMany({
    where: { userId },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          domain: true,
          website: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.client.id,
    name: row.client.companyName,
    domain: row.client.domain,
    website: row.client.website,
    isPrimary: row.isPrimary,
  }));
}

/**
 * Fetches the primary client details for a user with role === "client".
 */
async function getClientDetails(clientId) {
  if (!clientId) return null;

  const client = await prisma.wehowareClient.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      companyName: true,
      domain: true,
      website: true,
    },
  });

  if (!client) return null;

  return {
    id: client.id,
    name: client.companyName,
    domain: client.domain,
    website: client.website,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      // NextAuth uses these credential fields for its built-in UI (not used here
      // since we have a custom login page, but required by the schema).
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /**
       * authorize — called by NextAuth when signIn('credentials', ...) fires.
       * Returns the user object to embed in the JWT, or null on failure.
       * Throw CredentialsSignin for authentication failures (cleaner error flow).
       */
      async authorize(credentials) {
        const { email, password } = credentials ?? {};

        if (!email || !password) {
          return null;
        }

        let profile;
        try {
          profile = await prisma.wehowareProfile.findUnique({
            where: { email: String(email) },
            select: {
              id: true,
              email: true,
              passwordHash: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              role: true,
              clientId: true,
            },
          });
        } catch (err) {
          console.error("[auth] DB error during credential lookup:", err);
          // Return null — do not expose DB error details to the client
          return null;
        }

        if (!profile || !profile.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          String(password),
          profile.passwordHash
        );

        if (!isValid) {
          return null;
        }

        // Shape returned here is available to jwt() callback as `user`
        return {
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName ?? "",
          lastName: profile.lastName ?? "",
          avatarUrl: profile.avatarUrl ?? "",
          role: profile.role,
          clientId: profile.clientId ?? null,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    // 8-hour session — short enough to catch role changes; long enough for a workday
    maxAge: 8 * 60 * 60,
  },

  callbacks: {
    /**
     * jwt — runs when a token is created (login) or refreshed.
     * Embed minimal claims so the token stays small.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clientId = user.clientId;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.avatarUrl = user.avatarUrl;
      }
      return token;
    },

    /**
     * session — shapes the session object visible to useSession() / auth().
     * Keep accessibleClients OUT of the session — fetch them in the API
     * so they always reflect the latest DB state.
     */
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.clientId = token.clientId;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.avatarUrl = token.avatarUrl;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  // NextAuth will log detailed errors in development automatically
  debug: process.env.NODE_ENV === "development",
});

// Export helpers so API routes can reuse them without re-implementing
export { getAccessibleClients, getClientDetails, ROLES_WITH_CLIENT_ACCESS };
