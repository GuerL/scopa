package com.guerl.scopa.multiplayer.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PingWebSocketHandler pingWebSocketHandler;

    public WebSocketConfig(PingWebSocketHandler pingWebSocketHandler) {
        this.pingWebSocketHandler = pingWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(pingWebSocketHandler, "/ws/ping")
                .setAllowedOriginPatterns("*");
    }
}
