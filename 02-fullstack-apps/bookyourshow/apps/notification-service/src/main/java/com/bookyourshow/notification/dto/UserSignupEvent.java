package com.bookyourshow.notification.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors payload from bys.user.signup topic */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserSignupEvent {
    private String userId;
    private String name;
    private String email;
}
