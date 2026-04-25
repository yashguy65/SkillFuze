package com.skillfuze.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.skillfuze.entity.User;

public interface UserRepository extends JpaRepository<User, UUID> {}