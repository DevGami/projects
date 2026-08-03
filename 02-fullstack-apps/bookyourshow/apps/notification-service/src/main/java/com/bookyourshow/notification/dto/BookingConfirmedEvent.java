package com.bookyourshow.notification.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Mirrors payload from bys.booking.confirmed topic.
 * Produced by booking.service.ts → emitBookingConfirmed()
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class BookingConfirmedEvent {
    private String bookingId;
    private String userId;
    private String userEmail;
    private String movieTitle;
    private Object seats;
    private Object totalAmount;
    private String showDate;
    private String showTime;
    private String screen;
    private String theater;
    private String city;
    private String address;
}
