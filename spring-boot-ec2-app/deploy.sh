#!/bin/bash

# Spring Boot to EC2 Deployment Script
# AWS EC2에 Spring Boot 애플리케이션을 Docker로 배포하는 스크립트

set -e

echo "=== Spring Boot EC2 배포 스크립트 시작 ==="

# 1. 환경 변수 확인
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_DEFAULT_REGION" ]; then
    echo "❌ AWS 인증 정보가 설정되지 않았습니다."
    echo "다음 환경 변수를 설정해주세요:"
    echo "  export AWS_ACCESS_KEY_ID=your_access_key"
    echo "  export AWS_SECRET_ACCESS_KEY=your_secret_key"
    echo "  export AWS_DEFAULT_REGION=your_region"
    exit 1
fi

# 2. Spring Boot 애플리케이션 빌드
echo "📦 Spring Boot 애플리케이션 빌드 중..."
./gradlew build

# 3. Docker 이미지 빌드
echo "🐳 Docker 이미지 빌드 중..."
cp build/libs/app.jar ./app.jar
docker build -t spring-boot-ec2-app .

# 4. AWS ECR에 이미지 푸시 (선택사항)
if [ "$1" = "--push-to-ecr" ]; then
    echo "📤 AWS ECR에 이미지 푸시 중..."
    # ECR 로그인
    aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
    
    # ECR 리포지토리가 없으면 생성
    aws ecr describe-repositories --repository-names spring-boot-ec2-app --region $AWS_DEFAULT_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name spring-boot-ec2-app --region $AWS_DEFAULT_REGION
    
    # 이미지 태깅 및 푸시
    docker tag spring-boot-ec2-app:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/spring-boot-ec2-app:latest
    docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/spring-boot-ec2-app:latest
fi

# 5. EC2 인스턴스 설정
echo "☁️  EC2 인스턴스 설정 중..."

# Key Pair 확인
echo "🔑 Key Pair 목록:"
aws ec2 describe-key-pairs --query 'KeyPairs[*].KeyName' --output table

# Security Group 생성/확인
echo "🔒 Security Group 설정 중..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name spring-boot-sg \
    --description "Security group for Spring Boot application" \
    --query 'GroupId' --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
    --group-names spring-boot-sg \
    --query 'SecurityGroups[0].GroupId' --output text)

echo "Security Group ID: $SECURITY_GROUP_ID"

# HTTP 포트 8080 열기
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 8080 \
    --cidr 0.0.0.0/0 2>/dev/null || echo "포트 8080 이미 열려있음"

# SSH 포트 22 열기
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 2>/dev/null || echo "포트 22 이미 열려있음"

# 6. EC2 인스턴스 시작 (사용자가 직접 실행해야 함)
echo "🚀 EC2 인스턴스 시작 명령어:"
echo "aws ec2 run-instances \\"
echo "    --image-id ami-0c02fb55956c7d316 \\"
echo "    --count 1 \\"
echo "    --instance-type t2.micro \\"
echo "    --key-name YOUR_KEY_PAIR_NAME \\"
echo "    --security-group-ids $SECURITY_GROUP_ID \\"
echo "    --user-data file://user-data.sh"

echo ""
echo "=== 배포 스크립트 완료 ==="
echo "다음 단계:"
echo "1. KEY_PAIR_NAME을 실제 키 페어 이름으로 변경"
echo "2. EC2 인스턴스 시작 명령어 실행"
echo "3. 인스턴스가 시작되면 퍼블릭 IP를 확인하여 http://PUBLIC_IP:8080 접속"
