package com.skillfuze.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.skillfuze.entity.ChatGroupMessage;

@Repository
public interface ChatGroupMessageRepository extends JpaRepository<ChatGroupMessage, UUID> {

    List<ChatGroupMessage> findByGroupIdOrderByCreatedAtAsc(UUID groupId);

    @Query("SELECT COUNT(m) FROM ChatGroupMessage m WHERE m.groupId = :groupId AND m.senderId != :userId AND m.createdAt > :since")
    long countUnreadGroupMessages(@Param("groupId") UUID groupId, @Param("userId") UUID userId, @Param("since") Instant since);
}
