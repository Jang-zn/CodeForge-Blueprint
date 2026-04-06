## 예시

- 이런 서비스예요: 팀의 반복적인 배포 작업을 자동화하는 CLI 도구입니다. `deploy` 명령 하나로 git tag 생성 → Docker 이미지 빌드 → 레지스트리 푸시 → Slack 배포 알림까지 한 번에 처리합니다.
- 주요 화면: CLI 명령어 인터페이스 (TUI 없음), 진행 상태 스피너 출력, 배포 완료/실패 시 Slack 메시지(버전·변경 로그·담당자 포함), 로컬 `~/.config/deploy-tool/config.yaml` 설정 파일
- 사용 흐름: 팀원이 `npx deploy-tool patch "버그 수정"` 실행 → 버전 자동 bump + git tag → Docker 빌드 → 레지스트리 푸시 → Slack #deploy 채널에 알림 → 실패 시 에러 로그 출력 후 종료
- 경쟁 서비스와 다른 점: GitHub Actions는 설정이 복잡하고 브라우저를 열어야 합니다. 우리 도구는 터미널에서 한 줄로 끝나며, 팀 고유 레지스트리·Slack 연동을 `config.yaml` 하나로 관리합니다.
- 처음에 꼭 필요한 기능: semantic versioning 자동 bump (patch/minor/major), git tag 및 push, Docker 빌드·푸시, Slack Webhook 알림, config.yaml 기반 환경 설정

## 골격

- 이런 서비스예요:
- 주요 화면:
- 사용 흐름:
- 경쟁 서비스와 다른 점:
- 처음에 꼭 필요한 기능:
