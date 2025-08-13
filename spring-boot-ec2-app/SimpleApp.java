public class SimpleApp {
    public static void main(String[] args) {
        System.out.println("Simple Spring Boot Application Started on port 8080");
        System.out.println("Application is running...");
        // 간단한 HTTP 서버 시뮬레이션
        while (true) {
            try {
                Thread.sleep(5000);
                System.out.println("Application heartbeat...");
            } catch (InterruptedException e) {
                break;
            }
        }
    }
}
