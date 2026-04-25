package com.skillfuze.config;

import java.io.IOException;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtFilter extends OncePerRequestFilter {

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

        // TODO: validate Supabase JWT later
        filterChain.doFilter(request, response);
    }
}

