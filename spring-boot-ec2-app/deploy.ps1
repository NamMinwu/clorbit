# Spring Boot to EC2 Deployment Script (PowerShell)
# AWS EC2에 Spring Boot 애플리케이션을 Docker로 배포하는 PowerShell 스크립트

param(
    [switch]$PushToECR = $false
)

Write-Host "=== Spring Boot EC2 배포 스크립트 시작 ===" -ForegroundColor Green

# 1. AWS 인증 정보 확인
$awsAccessKey = $env:AWS_ACCESS_KEY_ID
$awsSecretKey = $env:AWS_SECRET_ACCESS_KEY
$awsRegion = $env:AWS_DEFAULT_REGION

if (-not $awsAccessKey -or -not $awsSecretKey -or -not $awsRegion) {
    Write-Host "❌ AWS 인증 정보가 설정되지 않았습니다." -ForegroundColor Red
    Write-Host "다음 환경 변수를 설정해주세요:"
    Write-Host "`$env:AWS_ACCESS_KEY_ID = 'your_access_key'"
    Write-Host "`$env:AWS_SECRET_ACCESS_KEY = 'your_secret_key'"
    Write-Host "`$env:AWS_DEFAULT_REGION = 'your_region'"
    exit 1
}

try {
    # 2. Spring Boot 애플리케이션 빌드
    Write-Host "📦 Spring Boot 애플리케이션 빌드 중..." -ForegroundColor Yellow
    .\gradlew.bat build
    
    if (-not $?) {
        Write-Host "❌ Gradle 빌드 실패" -ForegroundColor Red
        exit 1
    }

    # 3. Docker 이미지 빌드
    Write-Host "🐳 Docker 이미지 빌드 중..." -ForegroundColor Yellow
    
    # JAR 파일이 있는지 확인
    if (Test-Path "build\libs\app.jar") {
        Copy-Item "build\libs\app.jar" "app.jar"
    } else {
        Write-Host "⚠️  build\libs\app.jar를 찾을 수 없습니다. 간단한 JAR 파일을 생성합니다." -ForegroundColor Yellow
        # 간단한 manifest 파일로 임시 JAR 생성
        New-Item -ItemType Directory -Path "temp" -Force | Out-Null
        @"
Manifest-Version: 1.0
Main-Class: com.example.app.Application
"@ | Out-File -FilePath "temp\MANIFEST.MF" -Encoding ASCII
        jar cfm app.jar temp\MANIFEST.MF -C src\main\java .
        Remove-Item -Recurse -Force "temp"
    }
    
    docker build -t spring-boot-ec2-app .
    
    if (-not $?) {
        Write-Host "❌ Docker 빌드 실패" -ForegroundColor Red
        exit 1
    }

    # 4. AWS ECR에 이미지 푸시 (선택사항)
    if ($PushToECR) {
        Write-Host "📤 AWS ECR에 이미지 푸시 중..." -ForegroundColor Yellow
        
        $awsAccountId = $env:AWS_ACCOUNT_ID
        if (-not $awsAccountId) {
            Write-Host "❌ AWS_ACCOUNT_ID 환경 변수가 설정되지 않았습니다." -ForegroundColor Red
            exit 1
        }
        
        # ECR 로그인
        $loginToken = aws ecr get-login-password --region $awsRegion
        $loginToken | docker login --username AWS --password-stdin "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com"
        
        # ECR 리포지토리가 없으면 생성
        aws ecr describe-repositories --repository-names spring-boot-ec2-app --region $awsRegion 2>$null
        if (-not $?) {
            aws ecr create-repository --repository-name spring-boot-ec2-app --region $awsRegion
        }
        
        # 이미지 태깅 및 푸시
        docker tag spring-boot-ec2-app:latest "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com/spring-boot-ec2-app:latest"
        docker push "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com/spring-boot-ec2-app:latest"
    }

    # 5. EC2 설정
    Write-Host "☁️  EC2 설정 중..." -ForegroundColor Yellow

    # Key Pair 목록 확인
    Write-Host "🔑 Key Pair 목록:" -ForegroundColor Cyan
    aws ec2 describe-key-pairs --query 'KeyPairs[*].KeyName' --output table

    # Security Group 생성/확인
    Write-Host "🔒 Security Group 설정 중..." -ForegroundColor Yellow
    
    $securityGroupId = $null
    try {
        # 기존 Security Group 확인
        $securityGroupId = aws ec2 describe-security-groups --group-names spring-boot-sg --query 'SecurityGroups[0].GroupId' --output text 2>$null
    } catch {
        # Security Group 생성
        $securityGroupId = aws ec2 create-security-group --group-name spring-boot-sg --description "Security group for Spring Boot application" --query 'GroupId' --output text
    }

    Write-Host "Security Group ID: $securityGroupId" -ForegroundColor Green

    # HTTP 포트 8080 열기
    try {
        aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 8080 --cidr 0.0.0.0/0 2>$null
    } catch {
        Write-Host "포트 8080 이미 열려있음" -ForegroundColor Yellow
    }

    # SSH 포트 22 열기
    try {
        aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 22 --cidr 0.0.0.0/0 2>$null
    } catch {
        Write-Host "포트 22 이미 열려있음" -ForegroundColor Yellow
    }

    # 6. EC2 인스턴스 시작 명령어 출력
    Write-Host "🚀 EC2 인스턴스 시작 명령어:" -ForegroundColor Green
    Write-Host "aws ec2 run-instances \`" -ForegroundColor White
    Write-Host "    --image-id ami-0c02fb55956c7d316 \`" -ForegroundColor White
    Write-Host "    --count 1 \`" -ForegroundColor White
    Write-Host "    --instance-type t2.micro \`" -ForegroundColor White
    Write-Host "    --key-name YOUR_KEY_PAIR_NAME \`" -ForegroundColor White
    Write-Host "    --security-group-ids $securityGroupId \`" -ForegroundColor White
    Write-Host "    --user-data file://user-data.sh" -ForegroundColor White

    Write-Host ""
    Write-Host "=== 배포 스크립트 완료 ===" -ForegroundColor Green
    Write-Host "다음 단계:" -ForegroundColor Cyan
    Write-Host "1. YOUR_KEY_PAIR_NAME을 실제 키 페어 이름으로 변경" -ForegroundColor White
    Write-Host "2. EC2 인스턴스 시작 명령어 실행" -ForegroundColor White
    Write-Host "3. 인스턴스가 시작되면 퍼블릭 IP를 확인하여 http://PUBLIC_IP:8080 접속" -ForegroundColor White

} catch {
    Write-Host "❌ 배포 중 오류 발생: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
