# 🚀 AWS EC2 Spring Boot Docker 배포 - 빠른 실행 가이드

## ✅ 현재 준비된 것들
- ✅ Spring Boot 애플리케이션 코드
- ✅ Docker 이미지 (spring-boot-ec2-app:latest)  
- ✅ AWS CLI 설치 및 인증 완료
- ✅ 배포 스크립트들

## 📋 단계별 실행 명령어

### 1단계: Security Group 생성
```powershell
# Spring Boot용 Security Group 생성
aws ec2 create-security-group --group-name spring-boot-sg --description "Security group for Spring Boot application"

# HTTP 포트 8080 열기
aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port 8080 --cidr 0.0.0.0/0

# SSH 포트 22 열기
aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port 22 --cidr 0.0.0.0/0
```

### 2단계: Key Pair 생성 (필요한 경우)
```powershell
# 새 Key Pair 생성
aws ec2 create-key-pair --key-name spring-boot-key --query 'KeyMaterial' --output text > spring-boot-key.pem

# Key Pair 목록 확인
aws ec2 describe-key-pairs --query 'KeyPairs[*].KeyName' --output table
```

### 3단계: Docker 이미지를 ECR에 푸시 (선택사항)
```powershell
# ECR 리포지토리 생성
aws ecr create-repository --repository-name spring-boot-ec2-app

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin [계정ID].dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 태깅 및 푸시
docker tag spring-boot-ec2-app:latest [계정ID].dkr.ecr.ap-northeast-2.amazonaws.com/spring-boot-ec2-app:latest
docker push [계정ID].dkr.ecr.ap-northeast-2.amazonaws.com/spring-boot-ec2-app:latest
```

### 4단계: EC2 인스턴스 시작
```powershell
# EC2 인스턴스 시작 (Amazon Linux 2023)
aws ec2 run-instances `
    --image-id ami-0c2d3e23f757b5d84 `
    --count 1 `
    --instance-type t2.micro `
    --key-name spring-boot-key `
    --security-groups spring-boot-sg `
    --user-data file://user-data.sh
```

### 5단계: 인스턴스 상태 확인
```powershell
# 실행 중인 인스턴스 확인
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]' --output table

# 특정 인스턴스의 퍼블릭 IP 확인
aws ec2 describe-instances --instance-ids [인스턴스-ID] --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
```

## 🌐 접속 확인

인스턴스가 완전히 시작되면 (약 2-3분 후):

```powershell
# 애플리케이션 접속 테스트
curl http://[퍼블릭-IP]:8080/
```

## 🐛 문제 해결

### EC2 인스턴스에 SSH 접속
```powershell
ssh -i spring-boot-key.pem ec2-user@[퍼블릭-IP]
```

### 애플리케이션 로그 확인
```bash
# EC2 인스턴스 내에서
sudo tail -f /var/log/user-data.log
sudo docker logs $(sudo docker ps -q)
```

## 🧹 리소스 정리

### 인스턴스 종료
```powershell
aws ec2 terminate-instances --instance-ids [인스턴스-ID]
```

### Security Group 삭제
```powershell
aws ec2 delete-security-group --group-name spring-boot-sg
```

### Key Pair 삭제
```powershell
aws ec2 delete-key-pair --key-name spring-boot-key
```

---

## 🎯 빠른 시작 (한 번에 실행)

아래 명령어들을 순서대로 실행하세요:

```powershell
# 1. Security Group 생성
aws ec2 create-security-group --group-name spring-boot-sg --description "Security group for Spring Boot application"
aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port 8080 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name spring-boot-sg --protocol tcp --port 22 --cidr 0.0.0.0/0

# 2. Key Pair 생성
aws ec2 create-key-pair --key-name spring-boot-key --query 'KeyMaterial' --output text > spring-boot-key.pem

# 3. EC2 인스턴스 시작
aws ec2 run-instances --image-id ami-0c2d3e23f757b5d84 --count 1 --instance-type t2.micro --key-name spring-boot-key --security-groups spring-boot-sg --user-data file://user-data.sh

# 4. 인스턴스 퍼블릭 IP 확인 (2-3분 후)
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].PublicIpAddress' --output text

# 5. 애플리케이션 접속 (5분 후)
# curl http://[퍼블릭-IP]:8080/
```

모든 준비가 완료되었습니다! 🎉
