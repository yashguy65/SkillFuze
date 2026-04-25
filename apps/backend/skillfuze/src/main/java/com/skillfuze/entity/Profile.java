package com.skillfuze.entity;

import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

@Entity
public class Profile {

    @Id
    private UUID id;

    @ManyToOne
    private User user;

    private String bio;
}