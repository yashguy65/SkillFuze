package com.skillfuze.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Base64;
import java.util.Collections;
import java.util.UUID;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
                                    throws ServletException, IOException {

        String path = request.getRequestURI();
        
        // Skip JWT validation for health endpoint
        if (path.equals("/health")) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                String userIdStr = getSubjectFromToken(token);
                if (userIdStr != null) {
                    UUID userId = UUID.fromString(userIdStr);
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userId.toString(), null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                // ignore
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getSubjectFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            byte[] decodedBytes;
            try {
                decodedBytes = Base64.getUrlDecoder().decode(parts[1]);
            } catch (IllegalArgumentException e) {
                decodedBytes = Base64.getDecoder().decode(parts[1]);
            }
            JsonNode payloadNode = objectMapper.readTree(decodedBytes);
            if (payloadNode.has("sub")) {
                return payloadNode.get("sub").asText();
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }
}

