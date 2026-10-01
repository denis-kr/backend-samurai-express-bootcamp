import nodemailer from "nodemailer";

export const emailAdapter = {
  async sendEmail(email: string, subject: string, message: string) {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const info = await transport.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: subject,
      html: message,
    });

    return info;
  },
};
