export const metadata = {
  title: "Terms of Service | Runway Recruit",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-3xl bg-white rounded-xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Effective Date: March 1, 2026 &nbsp;|&nbsp; Last Updated: March 1, 2026</p>

        <p className="text-gray-700 mb-6">
          These Terms of Service ("Terms") govern your access to and use of Runway Recruit, operated by{" "}
          <strong>Runway Sports Technologies</strong> ("we," "us," or "our"), accessible at{" "}
          <strong>runwayrecruit.com</strong>. By accessing or using our platform, you agree to be bound by
          these Terms. If you do not agree, do not use the service.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Eligibility</h2>
          <p className="text-gray-700">
            You must be at least 13 years of age to use this platform. By using the service, you represent that you
            meet this age requirement. If you are under 18, you represent that your parent or legal guardian has
            reviewed and agreed to these Terms on your behalf.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Account Registration</h2>
          <p className="text-gray-700 mb-3">
            You must sign in using a valid Google account. You are responsible for maintaining the security of your
            account and for all activity that occurs under it. You agree to:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Provide accurate and complete profile information</li>
            <li>Not share your account credentials with others</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>
          <p className="text-gray-700 mt-3">
            We reserve the right to suspend or terminate accounts that violate these Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Description of Service</h2>
          <p className="text-gray-700">
            Runway Recruit is a platform designed to help high school student-athletes manage their college
            recruiting outreach. Features include coach and program discovery, email campaign management via the Gmail
            API, direct message campaigns via the Twitter/X API, a recruiting pipeline tracker, and profile management.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Gmail and Twitter/X Integration</h2>
          <p className="text-gray-700 mb-3">
            By connecting your Gmail or Twitter/X account, you authorize Runway Recruit to:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Send emails from your Gmail account to college coaches at your direction</li>
            <li>Read incoming Gmail messages solely to detect replies from coaches</li>
            <li>Send direct messages from your Twitter/X account to coaches at your direction</li>
          </ul>
          <p className="text-gray-700 mt-3">
            You are solely responsible for the content of messages sent through the platform. You agree not to use
            these features to send spam, harassing messages, or content that violates Google's or Twitter/X's terms of
            service. You may revoke access at any time through your Google or Twitter/X account settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
          <p className="text-gray-700 mb-3">You agree not to:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Use the platform for any unlawful purpose</li>
            <li>Harass, threaten, or send unsolicited bulk messages to coaches or programs</li>
            <li>Misrepresent your identity, athletic credentials, or academic information</li>
            <li>Attempt to gain unauthorized access to any part of the platform</li>
            <li>Scrape, copy, or redistribute platform data without permission</li>
            <li>Use the platform in any way that violates NCAA, NAIA, or other governing body rules regarding
            recruiting</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Payments and Subscriptions</h2>
          <p className="text-gray-700">
            Certain features of the platform may require a paid subscription. Payments are processed securely through
            Stripe. Subscription fees are billed on a recurring basis as described at the time of purchase. You may
            cancel your subscription at any time; cancellation takes effect at the end of the current billing period.
            All fees are non-refundable except as required by law or as otherwise stated at the time of purchase.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Intellectual Property</h2>
          <p className="text-gray-700">
            All content, features, and functionality of the platform — including logos, text, software, and design —
            are owned by Runway Sports Technologies and protected by applicable intellectual property laws. You may not
            reproduce, distribute, or create derivative works without our express written permission. You retain
            ownership of any personal content you submit to the platform, and you grant us a limited license to use
            that content solely to operate the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Disclaimers</h2>
          <p className="text-gray-700">
            The platform is provided "as is" and "as available" without warranties of any kind, express or implied. We
            do not guarantee that the service will be uninterrupted, error-free, or that any particular recruiting
            outcome will be achieved. Coach contact information is provided for informational purposes and may not be
            current or accurate. We are not affiliated with any college, university, or athletic program.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
          <p className="text-gray-700">
            To the fullest extent permitted by law, Runway Sports Technologies shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising out of your use of or inability to use the
            platform, even if advised of the possibility of such damages. Our total liability to you for any claim
            shall not exceed the amount you paid us in the twelve months preceding the claim.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Termination</h2>
          <p className="text-gray-700">
            We reserve the right to suspend or terminate your access to the platform at any time for violation of these
            Terms or for any other reason at our sole discretion. You may delete your account at any time. Upon
            termination, your right to use the platform ceases immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing Law and Disputes</h2>
          <p className="text-gray-700">
            These Terms are governed by the laws of the State of Iowa, without regard to its conflict of law
            provisions. Any disputes arising from these Terms or your use of the platform shall be resolved in the
            state or federal courts located in Iowa, and you consent to personal jurisdiction in those courts.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to These Terms</h2>
          <p className="text-gray-700">
            We may update these Terms from time to time. We will notify you of material changes by posting the updated
            Terms with a new effective date. Continued use of the platform after changes constitutes your acceptance of
            the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Us</h2>
          <p className="text-gray-700">
            If you have questions about these Terms, please contact us at:
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
