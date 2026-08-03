package com.bookyourshow.notification.consumer;

import com.bookyourshow.notification.dto.BookingConfirmedEvent;
import com.bookyourshow.notification.dto.PasswordResetEvent;
import com.bookyourshow.notification.dto.UserSignupEvent;
import com.bookyourshow.notification.service.EmailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationConsumer {

    private final EmailService emailService;
    private final ObjectMapper objectMapper;

    // ── bys.booking.confirmed ───────────────────────────────────────────────
    @KafkaListener(topics = "bys.booking.confirmed", groupId = "${spring.kafka.consumer.group-id}")
    public void onBookingConfirmed(
            @Payload String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            Acknowledgment ack
    ) {
        log.info("📨 Received event on {}", topic);
        try {
            BookingConfirmedEvent event = objectMapper.readValue(message, BookingConfirmedEvent.class);

            String userEmail = event.getUserEmail();
            if (userEmail != null && !userEmail.isBlank()) {
                emailService.sendBookingConfirmation(event, userEmail);
            } else {
                log.warn("No userEmail in booking.confirmed event for bookingId={}, skipping email",
                         event.getBookingId());
            }
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to process booking.confirmed event: {}", e.getMessage(), e);
            ack.acknowledge(); // Ack to avoid poison-pill loop
        }
    }

    // ── bys.user.signup ─────────────────────────────────────────────────────
    @KafkaListener(topics = "bys.user.signup", groupId = "${spring.kafka.consumer.group-id}")
    public void onUserSignup(
            @Payload String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            Acknowledgment ack
    ) {
        log.info("📨 Received event on {}", topic);
        try {
            UserSignupEvent event = objectMapper.readValue(message, UserSignupEvent.class);
            emailService.sendWelcomeEmail(event);
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to process user.signup event: {}", e.getMessage(), e);
            ack.acknowledge();
        }
    }

    // ── bys.user.password-reset ─────────────────────────────────────────────
    @KafkaListener(topics = "bys.user.password-reset", groupId = "${spring.kafka.consumer.group-id}")
    public void onPasswordReset(
            @Payload String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            Acknowledgment ack
    ) {
        log.info("📨 Received event on {}", topic);
        try {
            PasswordResetEvent event = objectMapper.readValue(message, PasswordResetEvent.class);
            emailService.sendPasswordResetEmail(event);
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to process password-reset event: {}", e.getMessage(), e);
            ack.acknowledge();
        }
    }

    // ── bys.booking.cancelled ───────────────────────────────────────────────
    @KafkaListener(topics = "bys.booking.cancelled", groupId = "${spring.kafka.consumer.group-id}")
    public void onBookingCancelled(
            @Payload String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            Acknowledgment ack
    ) {
        log.info("📨 Received event on {} — cancellation email coming in M09", topic);
        ack.acknowledge();
    }

    // ── bys.payment.verified ────────────────────────────────────────────────
    @KafkaListener(topics = "bys.payment.verified", groupId = "${spring.kafka.consumer.group-id}")
    public void onPaymentVerified(
            @Payload String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            Acknowledgment ack
    ) {
        log.info("📨 Received event on {} — booking.confirmed handles the email", topic);
        ack.acknowledge();
    }
}
