package com.skillfuze.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.skillfuze.entity.ChatGroup;

@Repository
public interface ChatGroupRepository extends JpaRepository<ChatGroup, UUID> {
    List<ChatGroup> findByCreatedBy(UUID createdBy);
}
