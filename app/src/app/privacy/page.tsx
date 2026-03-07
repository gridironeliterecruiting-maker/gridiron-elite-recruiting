export const metadata = {
  title: "Privacy Policy | Runway Recruit",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-3xl bg-white rounded-xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Effective Date: March 1, 2026 &nbsp;|&nbsp; Last Updated: March 1, 2026</p>

        <p className="text-gray-700 mb-6">
          Runway Sports Technologies ("we," "us," or "our") operates Runway Recruit, accessible at{" "}
          <strong>runwayrecruit.com</strong>. This Privacy Policy explains how we collect, use, disclose, and
          protect your information when you use our platform. By using our service, you agree to the practices described
          in this policy.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
          <h3 className="font-semibold text-gray-800 mb-2">a. Account Information</h3>
          <p className="text-gray-700 mb-4">
            When you sign in with Google, we receive your name and email address from your Google account. This
            information is used to create and identify your account.
          </p>
          <h3 className="font-semibold text-gray-800 mb-2">b. Athletic Profile Information</h3>
          <p className="text-gray-700 mb-4">
            You may voluntarily provide information including your position, graduation year, high school, city, state,
            GPA, height, weight, phone number, Hudl film link, and Twitter/X handle. This information is used to
            personalize your recruiting outreach.
          </p>
          <h3 className="font-semibold text-gray-800 mb-2">c. Gmail Access</h3>
          <p className="text-gray-700 mb-4">
            With your explicit authorization, we access your Gmail account using Google's OAuth 2.0 to send recruiting
            emails on your behalf (<code className="text-sm bg-gray-100 px-1 rounded">gmail.send</code>) and to detect
            replies from college coaches (
            <code className="text-sm bg-gray-100 px-1 rounded">gmail.readonly</code>). We do not read, store, or
            analyze the content of your personal emails. Gmail access is used solely to power your recruiting outreach
            campaigns. Our use of Google user data complies with the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <h3 className="font-semibold text-gray-800 mb-2">d. Twitter/X Access</h3>
          <p className="text-gray-700 mb-4">
            With your explicit authorization, we access your Twitter/X account to send direct messages to college
            coaches on your behalf. We do not read your personal messages or post tweets without your action.
          </p>
          <h3 className="font-semibold text-gray-800 mb-2">e. Usage Data</h3>
          <p className="text-gray-700 mb-4">
            We collect information about how you interact with the platform, including pages visited, features used, and
            campaign activity. This helps us improve the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>To provide, operate, and improve the Runway Recruit platform</li>
            <li>To send recruiting emails and direct messages on your behalf at your direction</li>
            <li>To track coach engagement (opens, replies) for your campaigns</li>
            <li>To personalize outreach templates with your athletic profile information</li>
            <li>To communicate with you about your account or service updates</li>
            <li>To process payments (when applicable)</li>
            <li>To comply with legal obligations</li>
          </ul>
          <p className="text-gray-700 mt-4">
            We do not sell, rent, or share your personal information or Google user data with third parties for
            advertising or marketing purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Third-Party Services</h2>
          <p className="text-gray-700 mb-3">We use the following third-party services to operate the platform:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li><strong>Supabase</strong> — database and authentication infrastructure</li>
            <li><strong>Google (Gmail API, OAuth)</strong> — sign-in and email sending</li>
            <li><strong>Twitter/X API</strong> — direct message sending</li>
            <li><strong>Vercel</strong> — hosting and deployment</li>
            <li><strong>Stripe</strong> — payment processing (when applicable)</li>
          </ul>
          <p className="text-gray-700 mt-3">
            Each third-party service has its own privacy policy and data practices. We encourage you to review them.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Retention</h2>
          <p className="text-gray-700">
            We retain your information for as long as your account is active or as needed to provide the service. You
            may request deletion of your account and associated data at any time by contacting us at the email below.
            Gmail and Twitter/X tokens are deleted when you disconnect those accounts or delete your profile.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Children's Privacy</h2>
          <p className="text-gray-700">
            Our service is available to users aged 13 and older. We do not knowingly collect personal information from
            children under 13. If we become aware that a child under 13 has provided us with personal information, we
            will delete it promptly. If you believe a child under 13 has created an account, please contact us
            immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Security</h2>
          <p className="text-gray-700">
            We implement reasonable technical and organizational measures to protect your information. OAuth tokens are
            stored securely and encrypted at rest. However, no method of transmission over the internet is 100% secure,
            and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
          <p className="text-gray-700 mb-3">You have the right to:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your account and data</li>
            <li>Revoke Gmail or Twitter/X access at any time via your Google or Twitter/X account settings</li>
            <li>Opt out of non-essential communications</li>
          </ul>
          <p className="text-gray-700 mt-3">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:runwaysportstechnologies@gmail.com" className="text-blue-600 hover:underline">
              runwaysportstechnologies@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Governing Law</h2>
          <p className="text-gray-700">
            This Privacy Policy is governed by the laws of the State of Iowa, without regard to its conflict of law
            provisions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
          <p className="text-gray-700">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting
            the new policy on this page with an updated effective date. Continued use of the platform after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact Us</h2>
          <p className="text-gray-700">
            If you have questions about this Privacy Policy, please contact us at:
          </p>
          <div className="mt-3 text-gray-700">
            <p><strong>Runway Sports Technologies</strong></p>
            <p>Iowa, United States</p>
            <p>
              <a href="mailto:runwaysportstechnologies@gmail.com" className="text-blue-600 hover:underline">
                runwaysportstechnologies@gmail.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
