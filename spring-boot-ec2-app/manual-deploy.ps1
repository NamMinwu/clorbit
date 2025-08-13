# AWS EC2 Spring Boot 배포 - 단계별 실행 가이드

## 1단계: AWS 인증 정보 설정
# 실제 값으로 교체하세요
$env:AWS_ACCESS_KEY_ID = "YOUR_ACCESS_KEY_ID"
$env:AWS_SECRET_ACCESS_KEY = "YOUR_SECRET_ACCESS_KEY" 
$env:AWS_DEFAULT_REGION = "ap-northeast-2"  # 또는 원하는 리전
$env:AWS_ACCOUNT_ID = "dolphi1n404"

## 2단계: AWS CLI 설치 확인
# AWS CLI가 설치되어 있는지 확인
aws --version

## 3단계: Docker 이미지 확인
# 이미 빌드된 이미지 확인
docker images spring-boot-ec2-app

## 4단계: AWS Key Pair 목록 확인
# 사용할 수 있는 키 페어 확인
aws ec2 describe-key-pairs --query 'KeyPairs[*].KeyName' --output table

## 5단계: Security Group 생성/확인
# Security Group 생성 (이미 있다면 오류 무시)
$securityGroupId = aws ec2 create-security-group --group-name spring-boot-sg --description "Security group for Spring Boot application" --query 'GroupId' --output text 2>$null

# 기존 Security Group이 있다면 해당 ID 사용
if (-not $securityGroupId) {
    $securityGroupId = aws ec2 describe-security-groups --group-names spring-boot-sg --query 'SecurityGroups[0].GroupId' --output text
}

Write-Host "Security Group ID: $securityGroupId"

## 6단계: Security Group 규칙 추가
# HTTP 포트 8080 열기
aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 8080 --cidr 0.0.0.0/0 2>$null

# SSH 포트 22 열기  
aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 22 --cidr 0.0.0.0/0 2>$null

## 7단계: EC2 인스턴스 시작 명령어 생성
Write-Host "EC2 인스턴스 시작 명령어:"
Write-Host "aws ec2 run-instances --image-id ami-0c02fb55956c7d316 --count 1 --instance-type t2.micro --key-name YOUR_KEY_PAIR_NAME --security-group-ids $securityGroupId --user-data file://user-data.sh"
