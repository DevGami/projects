package com.bookyourshow.notification.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors payload from bys.user.password-reset topic */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PasswordResetEvent {
    private String userId;
    private String email;
    private String resetToken;
}
