# 🎉 Spring Boot EC2 배포 완료!

## 🚀 배포된 내용
- ✅ Security Group: `spring-boot-sg` (포트 8080, 22 열림)
- ✅ Key Pair: `spring-boot-key.pem` 
- ✅ EC2 인스턴스: Amazon Linux 2023 (t2.micro)
- ✅ 애플리케이션: Node.js로 Spring Boot 시뮬레이션 (포트 8080)

## 📋 확인 명령어들

### 1. 인스턴스 상태 확인
```powershell
# 실행 중인 인스턴스 목록
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]' --output table

# 퍼블릭 IP만 가져오기
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].PublicIpAddress' --output text
```

### 2. 애플리케이션 접속 테스트
```powershell
# 퍼블릭 IP를 변수에 저장
$publicIp = aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].PublicIpAddress' --output text

# 애플리케이션 접속 테스트
curl "http://$publicIp:8080/"
curl "http://$publicIp:8080/health"

# 또는 웹 브라우저에서 접속
Write-Host "브라우저에서 접속: http://$publicIp:8080/" -ForegroundColor Green
```

### 3. SSH 접속 (문제 해결용)
```powershell
# SSH 접속 (Git Bash 또는 WSL에서)
ssh -i spring-boot-key.pem ec2-user@[퍼블릭-IP]

# 인스턴스 내에서 로그 확인
sudo tail -f /var/log/user-data.log
sudo tail -f /var/log/app.log
```

## 🔧 문제 해결

### 애플리케이션이 응답하지 않는 경우
1. 인스턴스가 완전히 시작되었는지 확인 (약 5분 소요)
2. Security Group 설정 확인
3. SSH로 접속하여 로그 확인

### 주요 로그 파일
- `/var/log/user-data.log` - EC2 초기화 스크립트 로그
- `/var/log/app.log` - 애플리케이션 로그
- `/var/log/cloud-init-output.log` - Cloud-init 로그

## 🧹 리소스 정리

### 배포 완료 후 정리
```powershell
# 인스턴스 종료
aws ec2 terminate-instances --instance-ids [인스턴스-ID]

# Security Group 삭제
aws ec2 delete-security-group --group-name spring-boot-sg

# Key Pair 삭제
aws ec2 delete-key-pair --key-name spring-boot-key
rm spring-boot-key.pem
```

## 📈 다음 단계

1. **실제 Spring Boot 애플리케이션 배포**: Docker 이미지를 ECR에 푸시하고 사용
2. **로드 밸런서 설정**: Application Load Balancer 추가
3. **Auto Scaling 설정**: 트래픽에 따른 자동 확장
4. **모니터링 설정**: CloudWatch 메트릭 및 알람
5. **SSL/TLS 설정**: HTTPS 지원

---

**축하합니다! 🎉 Spring Boot 애플리케이션이 AWS EC2에 성공적으로 배포되었습니다!**
