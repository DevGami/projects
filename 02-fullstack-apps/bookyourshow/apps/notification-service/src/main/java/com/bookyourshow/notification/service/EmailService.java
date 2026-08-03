package com.bookyourshow.notification.service;

import com.bookyourshow.notification.dto.BookingConfirmedEvent;
import com.bookyourshow.notification.dto.PasswordResetEvent;
import com.bookyourshow.notification.dto.UserSignupEvent;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;

    @Value("${app.mail.from}")
    private String fromEmail;

    @Value("${app.mail.from-name}")
    private String fromName;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // ── Booking Confirmation Email ──────────────────────────────────────────
    public void sendBookingConfirmation(BookingConfirmedEvent event, String toEmail) {
        try {
            Context ctx = new Context();
            ctx.setVariable("bookingId", event.getBookingId());
            ctx.setVariable("movieTitle", event.getMovieTitle());
            ctx.setVariable("showDate", event.getShowDate());
            ctx.setVariable("showTime", event.getShowTime());
            ctx.setVariable("screen", event.getScreen());
            ctx.setVariable("theater", event.getTheater());
            ctx.setVariable("city", event.getCity());
            ctx.setVariable("address", event.getAddress());
            ctx.setVariable("totalAmount", event.getTotalAmount());
            ctx.setVariable("seats", event.getSeats());
            ctx.setVariable("frontendUrl", frontendUrl);

            String html = templateEngine.process("booking-confirmed", ctx);
            sendHtmlEmail(toEmail, "🎬 Booking Confirmed — " + event.getMovieTitle(), html);
            log.info("Booking confirmation email sent to {} for booking {}", toEmail, event.getBookingId());
        } catch (Exception e) {
            log.error("Failed to send booking confirmation to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Welcome Email ───────────────────────────────────────────────────────
    public void sendWelcomeEmail(UserSignupEvent event) {
        try {
            Context ctx = new Context();
            ctx.setVariable("name", event.getName());
            ctx.setVariable("email", event.getEmail());
            ctx.setVariable("frontendUrl", frontendUrl);

            String html = templateEngine.process("welcome", ctx);
            sendHtmlEmail(event.getEmail(), "🎉 Welcome to BookYourShow!", html);
            log.info("Welcome email sent to {}", event.getEmail());
        } catch (Exception e) {
            log.error("Failed to send welcome email to {}: {}", event.getEmail(), e.getMessage());
        }
    }

    // ── Password Reset Email ────────────────────────────────────────────────
    public void sendPasswordResetEmail(PasswordResetEvent event) {
        try {
            String resetLink = frontendUrl + "/auth/reset-password?token=" + event.getResetToken();

            Context ctx = new Context();
            ctx.setVariable("email", event.getEmail());
            ctx.setVariable("resetLink", resetLink);
            ctx.setVariable("frontendUrl", frontendUrl);

            String html = templateEngine.process("password-reset", ctx);
            sendHtmlEmail(event.getEmail(), "🔐 Reset Your BookYourShow Password", html);
            log.info("Password reset email sent to {}", event.getEmail());
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", event.getEmail(), e.getMessage());
        }
    }

    // ── Core Send Helper ────────────────────────────────────────────────────
    private void sendHtmlEmail(String to, String subject, String htmlBody)
            throws MessagingException, java.io.UnsupportedEncodingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(fromEmail, fromName);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        mailSender.send(message);
    }
}
