import nodemailer from "nodemailer";

export async function sendReceiptEmail(pdfBuffer, cpf) {
  try {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });

    const info = await transporter.sendMail({
      from: '"SESMT EPI" <no-reply@sesmt-epi.com>',
      to: `rh@empresa.com.br, colab-${cpf}@empresa.com.br`,
      subject: "Comprovante de Devolução de EPI",
      text: "Segue em anexo o comprovante digital da sua devolução de EPIs.",
      attachments: [
        {
          filename: `Recibo-EPI-${cpf}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("Email enviado: %s", info.messageId);
    console.log("URL de Visualização do Ethereal: %s", nodemailer.getTestMessageUrl(info));
    
    return nodemailer.getTestMessageUrl(info);
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    throw error;
  }
}
