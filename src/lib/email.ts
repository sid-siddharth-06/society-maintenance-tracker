import { Resend } from 'resend';
import { ComplaintStatus } from '../generated/prisma/client';

// Initialize Resend with the API key from environment
// In tests, this will be mocked anyway.
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.EMAIL_FROM || 'noreply@societymaintenance.com';

interface ComplaintStatusData {
  id: string;
  category: string;
  oldStatus?: ComplaintStatus;
  newStatus: ComplaintStatus;
  adminNote?: string;
  updatedAt: Date;
}

interface NoticeData {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  authorName: string;
}

/**
 * Sends an email notification to a resident when their complaint status changes.
 */
export async function sendComplaintStatusEmail(
  residentEmail: string,
  data: ComplaintStatusData
): Promise<void> {
  if (!resend) {
    console.warn('RESEND_API_KEY is not configured. Skipping email send.');
    return;
  }

  try {
    const htmlContent = `
      <h2>Complaint Status Update</h2>
      <p>Your complaint regarding <strong>${data.category}</strong> (ID: ${data.id}) has been updated.</p>
      <p><strong>New Status:</strong> ${data.newStatus}</p>
      ${data.oldStatus ? `<p><strong>Previous Status:</strong> ${data.oldStatus}</p>` : ''}
      ${data.adminNote ? `<p><strong>Admin Note:</strong> ${data.adminNote}</p>` : ''}
      <p><em>Updated at: ${data.updatedAt.toLocaleString()}</em></p>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: residentEmail,
      subject: `Complaint Status Updated: ${data.newStatus}`,
      html: htmlContent,
    });
    
    // Log success safely
    console.log(`Complaint status email sent successfully to resident for complaint ${data.id}`);
  } catch (error) {
    console.error('Failed to send complaint status email:', error);
    throw error; // Rethrow to allow caller to handle isolation
  }
}

/**
 * Sends an email notification to eligible residents when an important notice is posted.
 */
export async function sendImportantNoticeEmail(
  residentEmails: string[],
  data: NoticeData
): Promise<void> {
  if (!resend) {
    console.warn('RESEND_API_KEY is not configured. Skipping email send.');
    return;
  }

  if (residentEmails.length === 0) {
    return;
  }

  try {
    const htmlContent = `
      <h2>IMPORTANT NOTICE: ${data.title}</h2>
      <p><strong>Posted by:</strong> ${data.authorName} on ${data.createdAt.toLocaleDateString()}</p>
      <hr />
      <p style="white-space: pre-wrap;">${data.content}</p>
    `;

    await resend.emails.send({
      from: fromEmail,
      bcc: residentEmails, // Use BCC to protect resident privacy
      to: fromEmail,       // 'to' is required; we send to ourselves and BCC everyone else
      subject: `[IMPORTANT] ${data.title}`,
      html: htmlContent,
    });

    console.log(`Important notice email broadcasted successfully to ${residentEmails.length} residents.`);
  } catch (error) {
    console.error('Failed to send important notice email:', error);
    throw error; // Rethrow to allow caller to handle isolation
  }
}
