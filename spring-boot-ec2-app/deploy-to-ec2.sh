#!/bin/bash
# EC2 배포 스크립트 (AWS 설정 포함)

echo "🚀 Spring Boot EC2 배포 시작!"

# 1. Docker 이미지 확인
echo "📦 Docker 이미지 확인 중..."
docker images spring-boot-beginner-app

# 2. Docker Hub에 푸시 (선택사항)
echo "🐳 Docker Hub 업로드 준비..."
echo "docker tag spring-boot-beginner-app:latest your-dockerhub/spring-boot-app:latest"
echo "docker push your-dockerhub/spring-boot-app:latest"

# 3. EC2 인스턴스 생성 및 배포
echo "☁️ EC2 배포 명령어들:"
echo ""
echo "# Key Pair 생성"
echo "aws ec2 create-key-pair --key-name spring-boot-key --query 'KeyMaterial' --output text > spring-boot-key.pem"
echo "chmod 400 spring-boot-key.pem"
echo ""
echo "# Security Group 생성"
echo "aws ec2 create-security-group --group-name spring-boot-sg --description 'Spring Boot Security Group'"
echo "aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port 8080 --cidr 0.0.0.0/0"
echo "aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port 22 --cidr 0.0.0.0/0"
echo ""
echo "# EC2 인스턴스 생성"
echo "aws ec2 run-instances --image-id ami-0c2d3e23b5f5fc3e1 --count 1 --instance-type t2.micro --key-name spring-boot-key --security-groups spring-boot-sg --user-data file://user-data.sh"

echo ""
echo "🎯 AWS CLI 설정이 필요합니다:"
echo "1. aws configure"
echo "2. Access Key와 Secret Key 입력"
echo "3. Region: ap-northeast-2 입력"
