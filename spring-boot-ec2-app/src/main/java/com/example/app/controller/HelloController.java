package com.example.app.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
public class HelloController {
    
    @Value("${app.version:1.0.0}")
    private String appVersion;
    
    @GetMapping("/")
    public Map<String, Object> hello() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Hello from Spring Boot on EC2!");
        response.put("version", appVersion);
        response.put("timestamp", LocalDateTime.now());
        response.put("status", "running");
        return response;
    }
    
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("timestamp", LocalDateTime.now());
        response.put("service", "Spring Boot EC2 App");
        return response;
    }
    
    @GetMapping("/info")
    public Map<String, Object> info() {
        Map<String, Object> response = new HashMap<>();
        response.put("app", "Spring Boot EC2 Demo");
        response.put("version", appVersion);
        response.put("java.version", System.getProperty("java.version"));
        response.put("os.name", System.getProperty("os.name"));
        response.put("build.time", LocalDateTime.now());
        return response;
    }
}
