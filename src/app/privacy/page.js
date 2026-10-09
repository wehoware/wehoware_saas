export const metadata = {
  title: 'Privacy Policy - Wehoware Technologies',
  description: 'How Wehoware Technologies collects, uses, and protects your data.',
};

const sections = [
  {
    title: '1. Introduction',
    body: `Wehoware Technologies ("we", "us", "our") operates the Wehoware platform at app.wehoware.ca (the "Service"), a business management platform that includes client management, content management, CRM, and social media management features. This Privacy Policy explains what information we collect, how we use it, and the choices you have. By using the Service, you agree to the practices described in this policy.`,
  },
  {
    title: '2. Information We Collect',
    list: [
      'Account information: name, email address, and login credentials when you or your organization creates an account.',
      'Client workspace data: content, contacts, deals, tasks, forms, and other business data entered into the Service by your organization.',
      'Connected social account data: when you connect a social media account (Facebook, Instagram, Twitter/X, TikTok), we store the OAuth access tokens, account identifiers, profile information, and page/account lists returned by the platform APIs, solely to provide the connected features.',
      'Social content and engagement data: posts you create or schedule, messages and comments synced into the unified inbox, and post analytics retrieved from the platform APIs.',
      'Usage and technical data: IP address, browser type, device information, pages visited, and timestamps collected through server logs and cookies.',
    ],
  },
  {
    title: '3. How We Use Your Information',
    list: [
      'To provide, operate, and maintain the Service, including publishing scheduled posts and syncing conversations to your connected accounts.',
      'To authenticate you and secure your account.',
      'To provide customer support and respond to inquiries.',
      'To monitor usage, detect abuse, and improve the Service.',
      'To send service-related notices (e.g., security or account alerts).',
    ],
    body: 'We do not sell your personal information. We do not use social media platform data for advertising, profiling, or any purpose unrelated to the features you enabled.',
  },
  {
    title: '4. Social Media Platform Data',
    body: `When you connect a social media account, we access only the data permitted by the scopes you authorize. Access tokens are stored securely and used exclusively to perform actions you request (publish posts, fetch analytics, sync messages). You can disconnect an account at any time from the Social Media settings, which revokes our stored connection. Disconnecting a platform inside the platform's own settings (for example, Meta's app settings) triggers our deauthorize and data-deletion callbacks.`,
  },
  {
    title: '5. Data Sharing and Third Parties',
    body: `We share data only with the subprocessors needed to run the Service — cloud hosting (AWS), database and storage providers, and the social media platforms you explicitly connect. Each subprocessor is bound by contractual data-protection obligations. We may disclose information if required by law or to protect the rights, safety, and security of our users.`,
  },
  {
    title: '6. Data Retention',
    body: `We retain account and workspace data for as long as the account is active or as needed to provide the Service. Social media tokens are retained until you disconnect the account or they are revoked. Backups are retained for a limited period consistent with our backup schedule.`,
  },
  {
    title: '7. Data Deletion',
    body: `You may request deletion of your data at any time by emailing support@wehoware.com from the address associated with your account. For social media data, you can also remove our app from the platform's settings (for example, Meta Business Settings or Facebook Settings > Apps and Websites), which invokes our data deletion endpoint at https://www.app.wehoware.ca/api/v1/social/meta/data-deletion. Upon a verified request we delete associated personal data within 30 days, except where retention is required by law.`,
  },
  {
    title: '8. Security',
    body: `We use industry-standard measures including TLS encryption in transit, hashed passwords, encryption at rest for sensitive credentials, role-based access control, and tenant-level data isolation. No method of transmission or storage is 100% secure; if we become aware of a breach affecting your data, we will notify you in accordance with applicable law.`,
  },
  {
    title: '9. Your Rights',
    body: `Depending on your jurisdiction (including GDPR/EEA and Canadian privacy law), you may have the right to access, correct, export, restrict, or delete your personal information, and to object to certain processing. To exercise these rights, contact support@wehoware.com. We will respond within the timeframe required by applicable law.`,
  },
  {
    title: '10. Cookies',
    body: `We use cookies for authentication sessions and essential functionality. We do not use third-party advertising cookies. You can control cookies through your browser settings, though disabling session cookies will prevent login.`,
  },
  {
    title: '11. Children’s Privacy',
    body: `The Service is intended for business use and is not directed at children under 16. We do not knowingly collect personal information from children.`,
  },
  {
    title: '12. International Data Transfers',
    body: `Your data may be processed in countries other than your own, including Canada and the United States, where our infrastructure is hosted. We take steps to ensure appropriate safeguards are in place for cross-border transfers.`,
  },
  {
    title: '13. Changes to This Policy',
    body: `We may update this policy from time to time. Material changes will be posted on this page with an updated "Last updated" date. Continued use of the Service after changes take effect constitutes acceptance.`,
  },
  {
    title: '14. Contact Us',
    body: `Questions or requests regarding this policy or your data: support@wehoware.com — Wehoware Technologies.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-3xl px-4 md:px-6 py-16 md:py-24">
      <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-12">Last updated: October 10, 2026</p>
      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-semibold mb-3">{s.title}</h2>
            {s.body && (
              <p className="text-muted-foreground leading-relaxed">{s.body}</p>
            )}
            {s.list && (
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
                {s.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
