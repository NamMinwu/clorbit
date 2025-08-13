# AWS EC2에 Spring Boot 애플리케이션 Docker 배포 가이드

## 프로젝트 개요
이 프로젝트는 Spring Boot 애플리케이션을 Docker 컨테이너로 패키징하여 AWS EC2에 배포하는 완전한 솔루션을 제공합니다.

## 파일 구조
```
spring-boot-ec2-app/
├── src/
│   └── main/
│       ├── java/com/example/app/
│       │   ├── Application.java          # 메인 애플리케이션 클래스
│       │   └── controller/
│       │       └── HelloController.java  # REST 컨트롤러
│       └── resources/
│           └── application.properties    # 애플리케이션 설정
├── build.gradle                         # Gradle 빌드 설정
├── Dockerfile                           # Docker 이미지 빌드 설정
├── deploy.sh                           # 배포 자동화 스크립트
├── user-data.sh                        # EC2 인스턴스 초기화 스크립트
└── README.md                           # 이 파일
```

## 사전 요구사항

### 1. 로컬 개발 환경
- Java 17 이상
- Docker Desktop
- AWS CLI v2

### 2. AWS 계정 및 권한
- AWS 계정
- EC2, ECR, IAM 권한을 가진 IAM 사용자

## 배포 과정

### 1단계: AWS 인증 설정
```bash
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
export AWS_DEFAULT_REGION=ap-northeast-2  # 서울 리전
export AWS_ACCOUNT_ID=your_account_id
```

### 2단계: 애플리케이션 빌드 및 Docker 이미지 생성
```bash
# Spring Boot 애플리케이션 빌드
./gradlew build

# JAR 파일 복사
cp build/libs/app.jar ./app.jar

# Docker 이미지 빌드
docker build -t spring-boot-ec2-app .

# 로컬에서 테스트
docker run -p 8080:8080 spring-boot-ec2-app
```

### 3단계: AWS ECR에 이미지 푸시 (선택사항)
```bash
# ECR 로그인
aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com

# ECR 리포지토리 생성
aws ecr create-repository --repository-name spring-boot-ec2-app --region $AWS_DEFAULT_REGION

# 이미지 태깅 및 푸시
docker tag spring-boot-ec2-app:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/spring-boot-ec2-app:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/spring-boot-ec2-app:latest
```

### 4단계: EC2 Key Pair 생성
```bash
# Key Pair 생성
aws ec2 create-key-pair --key-name spring-boot-key --query 'KeyMaterial' --output text > spring-boot-key.pem
chmod 400 spring-boot-key.pem
```

### 5단계: Security Group 생성
```bash
# Security Group 생성
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name spring-boot-sg \
    --description "Security group for Spring Boot application" \
    --query 'GroupId' --output text)

# HTTP 포트 8080 열기
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 8080 \
    --cidr 0.0.0.0/0

# SSH 포트 22 열기
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0
```

### 6단계: EC2 인스턴스 시작
```bash
# EC2 인스턴스 시작
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --count 1 \
    --instance-type t2.micro \
    --key-name spring-boot-key \
    --security-group-ids $SECURITY_GROUP_ID \
    --user-data file://user-data.sh \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "인스턴스 ID: $INSTANCE_ID"
```

### 7단계: 퍼블릭 IP 확인 및 접속
```bash
# 퍼블릭 IP 확인 (인스턴스가 완전히 시작될 때까지 기다림)
aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text

# 애플리케이션 접속
curl http://PUBLIC_IP:8080
curl http://PUBLIC_IP:8080/health
```

## 자동화 스크립트 사용

### deploy.sh 스크립트 실행
```bash
# 권한 설정
chmod +x deploy.sh

# 일반 배포 (로컬 Docker 이미지만)
./deploy.sh

# ECR에 푸시하는 배포
./deploy.sh --push-to-ecr
```

## 애플리케이션 엔드포인트

### 기본 엔드포인트
- `GET /` - Hello World 메시지
- `GET /health` - 헬스 체크
- `GET /actuator/health` - Spring Actuator 헬스 체크

### 예시 응답
```bash
curl http://your-ec2-public-ip:8080/
# 응답: "Hello from Spring Boot on EC2!"

curl http://your-ec2-public-ip:8080/health
# 응답: "OK"
```

## 모니터링 및 로그

### EC2 인스턴스 로그 확인
```bash
# SSH 접속
ssh -i spring-boot-key.pem ec2-user@YOUR_PUBLIC_IP

# User Data 스크립트 로그 확인
sudo tail -f /var/log/user-data.log

# Docker 컨테이너 로그 확인
sudo docker logs $(sudo docker ps -q)
```

### Docker 컨테이너 상태 확인
```bash
# 실행 중인 컨테이너 확인
sudo docker ps

# 컨테이너 재시작
sudo docker restart $(sudo docker ps -q)
```

## 리소스 정리

### EC2 인스턴스 종료
```bash
aws ec2 terminate-instances --instance-ids $INSTANCE_ID
```

### Security Group 삭제
```bash
aws ec2 delete-security-group --group-id $SECURITY_GROUP_ID
```

### Key Pair 삭제
```bash
aws ec2 delete-key-pair --key-name spring-boot-key
rm spring-boot-key.pem
```

### ECR 리포지토리 삭제
```bash
aws ecr delete-repository --repository-name spring-boot-ec2-app --force
```

## 주의사항

1. **보안**: 실제 운영 환경에서는 Security Group에서 0.0.0.0/0 대신 필요한 IP 범위만 허용하세요.
2. **비용**: t2.micro 인스턴스는 AWS 프리티어에 포함되지만, 프리티어 한도를 초과하면 요금이 부과됩니다.
3. **모니터링**: CloudWatch를 통해 애플리케이션 및 인프라 모니터링을 설정하는 것을 권장합니다.
4. **백업**: 중요한 데이터는 정기적으로 백업하세요.

## 문제 해결

### 일반적인 문제들

1. **애플리케이션이 시작되지 않는 경우**
   - EC2 인스턴스의 사용자 데이터 로그 확인
   - Docker 컨테이너 로그 확인
   - Security Group 설정 확인

2. **외부에서 접속되지 않는 경우**
   - Security Group의 인바운드 규칙 확인
   - EC2 인스턴스의 퍼블릭 IP 확인
   - 애플리케이션이 0.0.0.0:8080에서 리스닝하는지 확인

3. **Docker 이미지 빌드 실패**
   - Gradle 빌드가 성공했는지 확인
   - app.jar 파일이 존재하는지 확인
   - Docker Desktop이 실행 중인지 확인
