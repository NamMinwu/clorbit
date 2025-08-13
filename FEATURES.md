# Clorbit MCP Server - 기능 설명서

## 🚀 개요

Clorbit MCP Server는 Spring Boot 애플리케이션을 AWS EC2에 자동으로 배포하기 위한 종합적인 MCP(Model Context Protocol) 도구 모음입니다. 개발자가 "나 aws ec2, 스프링부트로 배포하고 싶어"라고 말하면 자동으로 필요한 설정을 확인하고 단계별 가이드를 제공합니다.

**버전**: 4.0.0  
**주요 특징**: 지능형 AWS 설정 감지, 자동 배포, 초보자 친화적 가이드

---

## 📋 전체 기능 목록

### 🔧 기본 AWS 인프라 도구

#### 1. `add`
- **설명**: 두 숫자를 더합니다
- **용도**: 테스트 및 기본 기능 확인
- **매개변수**:
  - `a` (number): 첫 번째 숫자
  - `b` (number): 두 번째 숫자

#### 2. `generateDockerfile`
- **설명**: 애플리케이션을 위한 Dockerfile을 생성합니다
- **용도**: Spring Boot, Express, Next.js 등 다양한 프레임워크용 Docker 이미지 생성
- **매개변수**:
  - `baseImage` (string): 베이스 Docker 이미지
  - `appDir` (string): 애플리케이션 디렉토리
  - `startCommand` (string): 애플리케이션 시작 명령어
  - `framework` (optional): "spring" | "express" | "nextjs" | "python" | "custom"
  - `port` (optional, number): 노출할 포트 번호
  - `buildCommand` (optional, string): 빌드 명령어

#### 3. `generateEc2Command`
- **설명**: EC2 인스턴스를 생성하는 AWS 명령어를 생성합니다
- **용도**: AWS CLI를 통한 EC2 인스턴스 자동 생성
- **매개변수**:
  - `keyName` (string): SSH 키 페어 이름
  - `securityGroup` (string): 보안 그룹 이름
  - `amiId` (optional, string): AMI ID
  - `instanceType` (optional, string): 인스턴스 타입
  - `region` (optional, string): AWS 리전

#### 4. `awsConfigureCommand`
- **설명**: AWS CLI 자격 증명을 설정하는 명령어를 생성합니다
- **용도**: AWS 액세스 키 자동 설정
- **매개변수**:
  - `accessKeyId` (string): AWS 액세스 키 ID
  - `secretAccessKey` (string): AWS 시크릿 액세스 키
  - `region` (string): 기본 리전

#### 5. `setEc2Setting`
- **설명**: EC2 인스턴스에 SSH로 접속하여 설정 스크립트를 실행합니다
- **용도**: 배포된 EC2 인스턴스 원격 관리
- **매개변수**:
  - `sshKeyPath` (string): SSH 키 파일 경로
  - `host` (string): EC2 인스턴스 호스트
  - `setupScript` (string): 실행할 bash 스크립트
  - `user` (optional, string): SSH 사용자명 (기본값: "ec2-user")

#### 6. `installInEc2`
- **설명**: EC2 인스턴스에 Java, Docker 등 필수 소프트웨어를 설치합니다
- **용도**: 새로운 EC2 인스턴스 환경 구성
- **매개변수**:
  - `sshKeyPath` (string): SSH 키 파일 경로
  - `host` (string): EC2 인스턴스 호스트
  - `user` (optional, string): SSH 사용자명
  - `setupScript` (optional, string): 커스텀 설치 스크립트

### 🔍 AWS 리소스 조회 도구

#### 7. `listKeyPairs`
- **설명**: AWS EC2 키 페어 목록을 조회합니다
- **용도**: 사용 가능한 SSH 키 페어 확인
- **매개변수**:
  - `region` (optional, string): 조회할 AWS 리전

#### 8. `listSecurityGroups`
- **설명**: AWS EC2 보안 그룹 목록을 조회합니다
- **용도**: 기존 보안 그룹 확인 및 선택
- **매개변수**:
  - `region` (optional, string): 조회할 AWS 리전

#### 9. `generateSecurityGroup`
- **설명**: AWS EC2 보안 그룹을 생성합니다
- **용도**: Spring Boot 애플리케이션용 보안 규칙 자동 생성
- **매개변수**:
  - `groupName` (string): 보안 그룹 이름
  - `description` (string): 보안 그룹 설명
  - `vpcId` (optional, string): VPC ID
  - `region` (optional, string): AWS 리전

---

## 🚀 개선된 배포 도구

### 10. `analyzeProject`
- **설명**: 프로젝트 구조를 분석합니다
- **용도**: Spring Boot 프로젝트 자동 감지 및 설정 정보 추출
- **매개변수**:
  - `projectPath` (optional, string): 프로젝트 경로 (기본값: ".")

**분석 결과**:
- 프로젝트 타입 (Spring Boot, Maven/Gradle)
- 포트 번호 자동 감지
- 빌드 도구 확인
- 주요 설정 파일 위치

### 11. `buildApplication`
- **설명**: 애플리케이션을 빌드합니다
- **용도**: Maven 또는 Gradle을 통한 Spring Boot JAR 파일 생성
- **매개변수**:
  - `projectPath` (optional, string): 프로젝트 경로
  - `buildTool` (optional): "maven" | "gradle" | "auto" (기본값: "auto")
  - `skipTests` (optional, boolean): 테스트 스킵 여부 (기본값: true)
  - `profile` (optional, string): Spring 프로파일

**빌드 결과**:
- 빌드 성공/실패 상태
- 출력 JAR 파일 위치
- 빌드 소요 시간
- 에러 메시지 (실패 시)

### 12. `deployToEc2Improved` (개선된 버전)
- **설명**: Docker 이미지를 AWS EC2에 자동으로 배포합니다 (개선된 버전)
- **용도**: 완전 자동화된 EC2 배포 프로세스
- **매개변수**:
  - `dockerImage` (string): Docker 이미지 이름
  - `instanceType` (optional, string): EC2 인스턴스 타입
  - `region` (optional, string): AWS 리전
  - `keyPairName` (optional, string): SSH 키 페어 이름
  - `securityGroupName` (optional, string): 보안 그룹 이름
  - `port` (optional, number): 애플리케이션 포트
  - `autoCleanup` (optional, boolean): 자동 리소스 정리

**배포 과정**:
1. AWS 자격 증명 확인
2. 키 페어 및 보안 그룹 생성/확인
3. EC2 인스턴스 시작
4. Docker 설치 및 애플리케이션 배포
5. 헬스 체크 및 상태 모니터링

### 13. `mcp_clorbit_deployToEc2` (원본 버전)
- **설명**: Docker 이미지를 AWS EC2에 자동으로 배포합니다 (원본 버전)
- **용도**: 기본적인 EC2 배포 기능
- **매개변수**: deployToEc2Improved와 동일

### 14. `cleanupResources`
- **설명**: AWS 리소스를 정리합니다
- **용도**: 배포 테스트 후 불필요한 리소스 제거
- **매개변수**:
  - `region` (optional, string): AWS 리전
  - `dryRun` (optional, boolean): 실제 삭제 없이 목록만 확인

---

## 🧠 스마트 AI 도구 (v4.0 신기능)

### 15. `awsHelper`
- **설명**: AWS 설정을 도와주는 헬퍼 도구
- **용도**: AWS 초기 설정 가이드 및 문제 해결
- **기능**:
  - AWS CLI 설치 상태 확인
  - 자격 증명 설정 안내
  - 일반적인 AWS 설정 문제 해결

### 16. `smartAwsSetup`
- **설명**: 사용자가 AWS 배포를 원할 때 자동으로 설정을 확인하고 가이드를 제공합니다
- **용도**: 지능형 AWS 환경 분석 및 설정 가이드
- **매개변수**:
  - `userMessage` (string): 사용자 입력 메시지
  - `autoSetup` (optional, boolean): 자동 설정 시도 여부
  - `verbose` (optional, boolean): 상세한 설명 제공 여부

**분석 기능**:
- 사용자 의도 분석 (자연어 처리)
- AWS CLI 설치 상태 확인
- 자격 증명 설정 상태 확인
- 단계별 설정 가이드 제공
- 초보자를 위한 상세한 설명

### 17. `smartDeploy`
- **설명**: 지능형 배포 관리 도구
- **용도**: 사용자 수준에 맞는 맞춤형 배포 프로세스 제공
- **기능**:
  - 사용자 경험 수준 자동 감지
  - 프로젝트 상태 자동 분석
  - 맞춤형 배포 계획 생성
  - 단계별 실행 가이드

---

## 🎯 사용 시나리오

### 시나리오 1: 완전 초보자
```
사용자: "나 aws ec2, 스프링부트로 배포하고 싶어"
```

**시스템 응답**:
1. `smartAwsSetup` 도구가 자동으로 실행
2. AWS CLI 설치 상태 확인
3. 액세스 키 설정 가이드 제공
4. 단계별 설정 방법 안내

### 시나리오 2: AWS 설정 완료된 사용자
```
사용자: Spring Boot 프로젝트를 EC2에 배포
```

**시스템 응답**:
1. `analyzeProject`로 프로젝트 분석
2. `buildApplication`으로 JAR 파일 생성
3. `generateDockerfile`로 Docker 이미지 생성
4. `deployToEc2Improved`로 자동 배포

### 시나리오 3: 고급 사용자
```
사용자: 기존 Docker 이미지를 t3.medium 인스턴스에 배포
```

**시스템 응답**:
1. 직접 `deployToEc2Improved` 실행
2. 커스텀 매개변수 적용
3. 고급 모니터링 및 로그 제공

---

## 🔧 설치 및 사용

### 1. 의존성 설치
```bash
npm install
```

### 2. 빌드
```bash
npm run build
```

### 3. MCP 서버 시작
```bash
node dist/index.js
```

### 4. 기본 사용법
```javascript
// MCP 클라이언트에서 도구 호출 예시
await callTool("smartAwsSetup", {
  userMessage: "나 aws ec2, 스프링부트로 배포하고 싶어",
  verbose: true
});
```

---

## 🚨 주의사항

### AWS 자격 증명 보안
- 액세스 키는 절대 GitHub 등에 올리지 마세요
- 정기적으로 키를 회전(rotation) 하세요
- 최소 권한 원칙을 적용하세요

### 비용 관리
- 테스트 후에는 `cleanupResources` 도구로 리소스 정리
- t2.micro 인스턴스 사용 권장 (프리티어)
- 불필요한 인스턴스는 즉시 종료

### 지원 환경
- **운영체제**: Windows, macOS, Linux
- **Node.js**: 16.0 이상
- **Docker**: 20.0 이상 (로컬 빌드 시)
- **AWS CLI**: 2.0 이상

---

## 📚 추가 리소스

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [Docker Documentation](https://docs.docker.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

---

## 🎉 결론

Clorbit MCP Server는 개발자가 복잡한 AWS 설정 없이도 간단한 자연어 명령으로 Spring Boot 애플리케이션을 EC2에 배포할 수 있게 해주는 종합 솔루션입니다. 초보자부터 고급 사용자까지 모든 수준의 개발자가 효율적으로 클라우드 배포를 수행할 수 있습니다.
