package com.skillfuze.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.skillfuze.entity.ChatGroupMember;
import com.skillfuze.entity.ChatGroupMemberId;

@Repository
public interface ChatGroupMemberRepository extends JpaRepository<ChatGroupMember, ChatGroupMemberId> {

    List<ChatGroupMember> findByUserId(UUID userId);

    List<ChatGroupMember> findByGroupId(UUID groupId);

    boolean existsByGroupIdAndUserId(UUID groupId, UUID userId);

    Optional<ChatGroupMember> findByGroupIdAndUserId(UUID groupId, UUID userId);

    void deleteByGroupIdAndUserId(UUID groupId, UUID userId);
}
