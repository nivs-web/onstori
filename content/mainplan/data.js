/* 기획1 — 온스토리 이야기 엔진 기획실 · 단일 출처.
   2026-09-05 회장님 지시: "기획은 더 이상 추가·수정하지 않는다. 이 문서대로 만든다."
   섹션 순서 = 왼쪽 메뉴 순서. html 은 그대로 렌더된다(백틱 사용 금지). */
window.MAINPLAN = {
  updated: "2026-09-05 (저녁 · 레멘토 참고 방침 확정 반영)",
  sections: [

/* ───────────────────────── 01 새로운 기획안 ───────────────────────── */
{ id: "overview", group: "총괄", title: "새로운 기획안 (총괄 · 현황 · 작업 순서)",
  lead: "온스토리를 '홈페이지 빌더'에서 '사장님 이야기 엔진'으로 바꾼다. 레멘토(remento.co)의 구조·레이아웃·마케팅 방식을 그대로 가져오고, 내용만 소상공인 이야기로 바꾼다. 이 페이지는 무엇이 끝났고 무엇이 남았는지, 어디서부터 만드는지의 단일 출처다.",
  html: `
<div class="card dark">
  <b>한 문장 정의</b><br>
  사장님은 <mark>글을 쓰지 않는다</mark>. 문자로 온 <mark>링크만 누르고</mark>(카톡 로그인), <mark>앱 설치 없이</mark> 크롬에서 60초 녹화한다. 온스토리가 그 60초를 자막 영상·글·사진 카드로 만들어 유튜브 쇼츠·인스타 릴스·X·쓰레드·네이버 블로그(복붙 30초)·온스토리 홈페이지 블로그 6곳에 퍼뜨린다.
</div>

<h3>기획실 3개 — 서로 이동</h3>
<table><tr><th>방</th><th>주소</th><th>역할</th><th>상태</th></tr>
<tr><td><b>기획1</b></td><td><code>/mainplan</code></td><td>이야기 엔진 · 레멘토 구조 · 온보딩 · 작업지시서 (이 페이지)</td><td><span class="tag new">신설</span></td></tr>
<tr><td><b>기획2</b></td><td><code>/plandept</code></td><td>전략기획실 — 아이디어 78건 단계 보드 · 기획서 · 결정 대기</td><td><span class="tag done">운영 중</span></td></tr>
<tr><td><b>기획3</b></td><td><code>/onstoriplandept</code></td><td>사업 설계서 — 설계서 v3.3 · PROGRESS · DECISIONS (빌드 시 자동 생성)</td><td><span class="tag done">운영 중</span></td></tr></table>
<p class="note">세 방 모두 운영자 로그인(ADMIN_KEY 쿠키) 뒤에만 열린다. 왼쪽 위 기획1·기획2·기획3 버튼으로 서로 이동.</p>

<h3>현황 분석 — 완성된 것 (2026-09-05 기준, 저장소 실물 검토)</h3>
<table><tr><th>영역</th><th>완성된 것</th><th>파일</th></tr>
<tr><td>생성</td><td>상호명·한 줄·전화·주소·분위기 4택 → Gemini 분류·카피 → 이미지뱅크 사진 → 사이트 생성·발행 (30초)</td><td><code>app/new</code> <code>lib/generate.ts</code> <code>lib/bank.ts</code></td></tr>
<tr><td>렌더</td><td>고객 사이트 <code>onstori.com/{slug}</code> — 섹션 12종(히어로·소개·스토리피드·갤러리·후기·지도·배너·시공사례·진행과정·견적폼·영업시간·메뉴)</td><td><code>app/[slug]</code> <code>components/sections</code></td></tr>
<tr><td>에디터</td><td>폼 에디터 + 라이브 미리보기(iframe·postMessage·자동저장) + 스토리 작성(사진) + draft/발행 분리 + 완성도 점수 + 문의함 탭</td><td><code>app/[slug]/edit</code> <code>app/[slug]/preview</code></td></tr>
<tr><td>문의</td><td>견적 접수 → DB → 문자(솔라피)·이메일(Resend) 알림 — 프로덕션 검증</td><td><code>app/api/inquiry</code> <code>lib/notify.ts</code></td></tr>
<tr><td>계정</td><td>카카오 OIDC 직결 + 이메일 OTP, 익명 생성 → 로그인 시 귀속(claim), 마이페이지</td><td><code>app/login</code> <code>app/auth</code> <code>app/my</code></td></tr>
<tr><td>저장소</td><td>R2-1 — 신규 업로드 Cloudflare R2(<code>img.onstori.com</code>), env 없으면 Supabase 폴백</td><td><code>lib/storage.ts</code></td></tr>
<tr><td>이미지뱅크</td><td>638장 승인 재고 + 어드민 검수 화면 + 생성 스크립트(Vertex)</td><td><code>app/admin/bank</code> <code>scripts/bank-*.ts</code></td></tr>
<tr><td>운영</td><td>운영자 콘솔(뱅크·쇼케이스·사이트·서브도메인) + 기획실 2개 잠금 서빙</td><td><code>app/admin</code> <code>lib/private-static.ts</code></td></tr>
<tr><td>인프라</td><td>Vercel 자동배포 · Supabase(DB·Auth·RLS) · Cloudflare DNS/R2 · 예약 슬러그 200+ · 레이트리밋 · sitemap/robots</td><td><code>next.config.ts</code> <code>supabase/migrations</code></td></tr></table>

<h3>현황 분석 — 남은 것 (이번 기획으로 새로 생기는 일)</h3>
<table><tr><th>#</th><th>남은 작업</th><th>크기</th><th>이번 세션</th></tr>
<tr><td>1</td><td>기획1 <code>/mainplan</code> + 기획1·2·3 교차 버튼</td><td>소</td><td><span class="tag done">완료</span></td></tr>
<tr><td>2</td><td>첫 페이지 전면 재제작 — 레이아웃·순서는 레멘토 참고, 확정 히어로·ONSTORI 로고</td><td>중</td><td><span class="tag done">완료</span> <span class="tag wip">색·세부 UI 조정 남음(#remento)</span></td></tr>
<tr><td>3</td><td>상단 메뉴 5개 페이지 — 작동방식·사업이야기·자주묻는질문·리뷰·블로그 + 비교 페이지</td><td>중</td><td><span class="tag done">완료</span></td></tr>
<tr><td>4</td><td>랜덤 질문 위젯("사장님, 어떤 이야기를 들려주시겠습니까?" · 랜덤 질문 바꾸기 · 4장) + 질문 은행 100개</td><td>소</td><td><span class="tag done">완료</span></td></tr>
<tr><td>5</td><td>온보딩 5단계(상호명·플레이스 불러오기 → 세부 업종 → 한 줄·로고·주소·전화 → 다크/화이트 8색 → 1→100% 진행 → 정회원 안내)</td><td>대</td><td><span class="tag done">완료</span></td></tr>
<tr><td>6</td><td>14일 무료 → 차단 → 토스 49,000원 결제 모달 (키 등록 전까지 '준비 중' 표시) · 만료 크론</td><td>중</td><td><span class="tag done">완료(키 대기)</span></td></tr>
<tr><td>7</td><td>운영자 회원 목록 <code>/admin/members</code> (개설일·결제일·D-14·연락처·주소·홈페이지·완성도·이메일)</td><td>소</td><td><span class="tag done">완료</span></td></tr>
<tr><td>8</td><td>60초 녹화 페이지 <code>/rec</code>(크롬·MediaRecorder·업로드) + 문자 링크 발송 API</td><td>중</td><td><span class="tag done">1차 완료</span></td></tr>
<tr><td>9</td><td>녹화 → 자막·컷편집 워커(Cloud Run ffmpeg + AssemblyAI) → 세로 1080×1920 영상</td><td>대</td><td><span class="tag todo">클코팀장 (STEP 4)</span></td></tr>
<tr><td>10</td><td>말 → 글 가공(1인칭 다듬기·3인칭 소개·캡션 6종) + 이미지뱅크 스토리 카드(@vercel/og)</td><td>중</td><td><span class="tag todo">클코팀장 (STEP 5)</span></td></tr>
<tr><td>11</td><td>발행 연동 — 인스타/쓰레드(Meta Graph, 앱 리뷰 20일) · 유튜브(videos.insert) · X(유료만) · 네이버(복붙 안내)</td><td>대</td><td><span class="tag todo">클코팀장 (STEP 6~7)</span></td></tr>
<tr><td>12</td><td>이미지뱅크 어드민 생성기(키워드+숫자+버튼, 1,000×2K + 13,000×1K, 별점 자동)</td><td>중</td><td><span class="tag todo">클코팀장 (STEP 1)</span></td></tr>
<tr><td>13</td><td>토스페이먼츠 가맹 · 사업자등록 · 통신판매업 (사람)</td><td>—</td><td><span class="tag wip">회장님</span></td></tr>
<tr><td>14</td><td>Meta 앱 리뷰 · 비즈니스 인증 · 유튜브 API 감사 신청 (사람, 20일)</td><td>—</td><td><span class="tag wip">회장님</span></td></tr></table>

<h3>어디서부터 — 합리적 순서와 이유</h3>
<ol>
<li><b>보이는 것 먼저(1~4)</b> — 첫 페이지·메뉴·질문 위젯. 비용 0, 하루면 끝나고, 사장님에게 보여줄 얼굴이 생긴다. 홍보 전이라 위험도 0.</li>
<li><b>돈이 들어오는 길(5~7)</b> — 온보딩 5단계·14일·결제·회원목록. 결제 키는 가맹이 끝나야 들어오지만 화면·DB·크론은 지금 만들어 두면 키만 꽂으면 된다.</li>
<li><b>핵심 엔진(8~11)</b> — 녹화 → 워커 → 가공 → 발행. 8(녹화·업로드)은 이번에 만들었고, 9~11은 외부 승인(Meta 20일·유튜브 감사)이 병목이라 <u>신청을 오늘 넣고</u> 코드는 그 기간에 만든다.</li>
<li><b>뱅크 생성기(12)</b> — 크레딧 40만원은 3개월 안에 써야 하므로 워커와 병행. 하루 1,000장씩 14일.</li></ol>

<h3>이번 세션에서 실제로 바뀐 파일 (백업 후 반영)</h3>
<pre>신규  content/mainplan/*                     기획1 대시보드
신규  app/mainplan/[[...path]]/route.ts        기획1 라우트(운영자 게이트)
수정  next.config.ts                           content/mainplan 트레이싱
수정  content/plandept/index.html · scripts/build-plandept.ts   기획1·2·3 버튼
신규  supabase/migrations/20260905090000_mainplan_membership.sql  예약어·정회원 컬럼·스토리 영상 컬럼
수정  app/globals.css · app/layout.tsx         브랜드 토큰(포레스트·크림·라임)·메타
신규  public/brand/onstori-logo*.png           ONSTORI 로고
신규  components/site/*                        공용 헤더·푸터·질문 위젯·FAQ·결제 모달
신규  config/questions.ts · faq.ts · industry-picker.ts · palettes.ts
재작성 app/page.tsx                             레멘토 구조 첫 페이지
신규  app/how-it-works · our-story · faq · reviews · blog · compare
재작성 app/new/*                                온보딩 5단계
수정  app/api/generate/route.ts                업종·색·다크·로고·14일
신규  app/api/place-search · api/site/logo · api/billing/* · api/cron/expire · api/story/*
신규  app/rec/*                                60초 녹화 페이지
신규  app/admin/members                        회원 목록
수정  app/[slug]/edit/ui.tsx · api/site/get   무료 기간 표시·차단
수정  lib/sites.ts · app/[slug]/page.tsx       로고 표시
신규  lib/trial.ts · lib/story-link.ts</pre>
<p class="note">백업: 변경 전 원본은 <code>fable51plandept/backup-onstori-2026-09-05/</code> 에 그대로 복사해 두었다. 저장소 자체가 git 이므로 push 전 <code>git tag backup-2026-09-05</code> 한 줄이면 언제든 돌아간다.</p>
`},

/* ───────────────────────── 02 카피라이터 ───────────────────────── */
{ id: "copy", group: "첫 페이지", title: "카피라이터 문구 기획안",
  lead: "확정 히어로 1벌 + 예비 12안 + 섹션별 문구. 첫 페이지·온보딩·에디터·문자 문구까지 여기서 가져다 쓴다.",
  html: `
<div class="hero-demo">
  <div class="kicker">확정 (2026-09-05)</div>
  <p class="h">홈페이지는 텅 빈 상가입니다.<br>스토리에는 진짜 사람이 있습니다.</p>
  <p class="s">사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다. 온스토리.</p>
  <div class="b"><span>✎ 글쓰기 금지</span><span>🔗 문자 링크만 누르세요</span><span>⤓ 다운로드 없음</span></div>
  <p style="margin:14px 0 0"><span class="pill">녹화를 시도해보세요 · 60초면 됩니다</span></p>
</div>

<h4>서브서브 멘트 4개 (히어로 아래 신뢰 줄 · 온보딩 로딩 화면 · 문자 문구에 돌려쓴다)</h4>
<ol><li>60초만 말하세요. 나머지는 온스토리가 합니다.</li><li>질문은 저희가 드립니다. 사장님은 대답만.</li><li>얼굴이 안 나와도 됩니다. 목소리면 충분합니다.</li><li>3년 뒤에도 검색되는 영상, 오늘 60초.</li></ol>

<h4>예비 12안 (섹션 제목·광고·문자 헤드라인용)</h4>
<table><tr><th>#</th><th>헤드라인</th><th>쓰는 곳</th></tr>
<tr><td>1</td><td>홈페이지 제작이 아닙니다. 사업이 굴러가게 만듭니다.</td><td>비교 페이지 상단</td></tr>
<tr><td>2</td><td>사장님이 말하면, 손님이 찾아옵니다.</td><td>작동방식 히어로</td></tr>
<tr><td>3</td><td>글 못 써도 됩니다. 말은 하시잖아요.</td><td>온보딩 1단계</td></tr>
<tr><td>4</td><td>매주 60초, 3년 뒤 156편의 사장님 이야기.</td><td>가격 섹션</td></tr>
<tr><td>5</td><td>손님은 상품이 아니라 사람을 믿습니다.</td><td>사업이야기</td></tr>
<tr><td>6</td><td>이야기가 쌓이면 검색이 따라옵니다.</td><td>블로그 소개</td></tr>
<tr><td>7</td><td>사장님 목소리 하나로 6곳에 퍼집니다.</td><td>채널 섹션</td></tr>
<tr><td>8</td><td>앱도, 편집도, 글쓰기도 없습니다. 링크 하나뿐.</td><td>3배지 설명</td></tr>
<tr><td>9</td><td>오늘 손님 이야기가 내일 손님을 부릅니다.</td><td>최근손님이야기 카테고리</td></tr>
<tr><td>10</td><td>텅 빈 상가에 사람을 채우는 가장 빠른 방법.</td><td>광고</td></tr>
<tr><td>11</td><td>홈페이지는 있는데, 왜 손님이 없을까요?</td><td>비교 페이지 도입</td></tr>
<tr><td>12</td><td>14일 무료. 사장님 이야기부터 들려주세요.</td><td>정회원 안내</td></tr></table>

<h4>섹션별 문구 (첫 페이지 순서)</h4>
<table><tr><th>섹션</th><th>제목</th><th>본문 요지</th></tr>
<tr><td>상단 띠</td><td>오픈 기념 — 14일 전 기능 무료, 이후 49,000원</td><td>클릭 → /new</td></tr>
<tr><td>퍼지는 곳</td><td>한 번 말하면 6곳으로</td><td>유튜브 쇼츠 · 인스타 릴스 · 쓰레드 · X · 네이버 블로그 · 온스토리 홈페이지</td></tr>
<tr><td>온스토리란</td><td>온스토리는 무엇인가요?</td><td>"사장님의 60초를 홈페이지·영상·글로 바꾸는 이야기 엔진입니다."</td></tr>
<tr><td>작동방식 4단계</td><td>이렇게 작동합니다</td><td>①문자로 질문 도착 ②링크 누르고 60초 녹화 ③온스토리가 자막·글·사진 카드 제작 ④6곳에 퍼짐 + 홈페이지에 쌓임</td></tr>
<tr><td>창업자 편지</td><td>왜 온스토리를 만들었나</td><td>사업이야기 페이지 요약(아래 09 참조)</td></tr>
<tr><td>가격 카드</td><td>정회원 49,000원</td><td>포함 6가지 + 14일 무료 + 언제든 해지</td></tr>
<tr><td>사장님 것</td><td>전부 사장님 것입니다</td><td>홈페이지 · 영상 · 이야기 기록 (해지해도 가져감)</td></tr>
<tr><td>말→글</td><td>말하면 글이 됩니다</td><td>원문 / 1인칭 다듬기 / 3인칭 소개 3탭 샘플</td></tr>
<tr><td>질문 위젯</td><td>사장님, 어떤 이야기를 들려주시겠습니까?</td><td>[랜덤 질문 바꾸기] 4장</td></tr>
<tr><td>비교</td><td>아직 고민 중이신가요?</td><td>제작업체는 홈페이지를 줍니다. 온스토리는 손님을 부릅니다. → 비교 보기</td></tr>
<tr><td>FAQ</td><td>자주 묻는 질문</td><td>5개 미리보기 → 전체</td></tr>
<tr><td>마감 CTA</td><td>사장님 질문 20개 받기</td><td>이메일/문자 → 질문 20개 (준비 중이면 /new)</td></tr></table>
`},

/* ───────────────────────── 03 히어로 ───────────────────────── */
{ id: "hero", group: "첫 페이지", title: "히어로 섹션 기획안",
  lead: "레멘토 히어로의 뼈대(좌 텍스트 · 신뢰 3줄 · CTA 2개 · 우측 목업)를 참고하고, 내용·색·버튼 형태는 온스토리 것으로.",
  html: `
<h3>레이아웃 (배치는 레멘토 참고 · 색·형태는 독자)</h3>
<table><tr><th>레멘토</th><th>온스토리</th></tr>
<tr><td>상단 프로모 띠 "Get $10 off…"</td><td>"오픈 기념 — 14일 전 기능 무료 · 이후 49,000원" (서브색 #273D3D 얇은 띠, 흰 글자)</td></tr>
<tr><td>세리프 헤드라인 2줄</td><td>"홈페이지는 텅 빈 상가입니다. / 스토리에는 진짜 사람이 있습니다." (Noto Serif KR 700)</td></tr>
<tr><td>서브 1줄</td><td>"사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다. 온스토리."</td></tr>
<tr><td>체크 3줄 (No writing / Just click / No app)</td><td>3배지: ✎ 글쓰기 금지 · 🔗 문자 링크만 누르세요(카톡 로그인) · ⤓ 다운로드 없음</td></tr>
<tr><td>CTA "Buy now" 라임 알약 + "How it works" 텍스트</td><td>"녹화를 시도해보세요 · 60초" <b>#005B2A 초록 12px 버튼</b> → /new + "작동방식 보기 →"</td></tr>
<tr><td>별 5개 · 1,500+ reviews</td><td>정직 원칙: 리뷰 수 대신 "질문 100개 · 6개 채널 · 14일 무료" 사실 3개</td></tr>
<tr><td>우측: 책+폰 실물 사진</td><td>우측: 실제 작동 중인 고객 사이트 폰 프레임(기존 PhoneFrame 유지) + 녹화 화면 카드 겹침</td></tr></table>

<h3>녹화 안내 문장 (확정)</h3>
<div class="card lime"><b>녹화를 시도해보세요. 60초 정도 걸립니다.</b><br>로그인은 완전히 없앨 수 없다(카톡 인앱 브라우저는 카메라 녹화가 안 된다). 그래서 문자·카톡으로 받은 링크를 <u>크롬에서 여는 것</u>이 곧 로그인이다 — 레멘토가 이메일 링크로 web.remento.co 를 여는 방식과 같다.</div>

<h3>모바일</h3>
<p>헤드라인 28px → 폰 프레임은 히어로 아래로 내려가고, 3배지는 가로 스크롤. CTA는 화면 하단 고정 바로 한 번 더(레멘토 모바일과 동일).</p>
`},

/* ───────────────────────── 04 첫페이지 섹션 ───────────────────────── */
{ id: "sections", group: "첫 페이지", title: "첫 페이지 섹션 기획안 (순서표)",
  lead: "레멘토 홈 20섹션의 배치·순서를 참고한 온스토리 섹션 순서표(방침 ①). 색·세부 UI는 독자(방침 ②③). 기존 온스토리 섹션(포트폴리오·3단계·차별점·가격)은 버리지 않고 자리만 잡는다 — 지울지는 회장님이 나중에 결정.",
  html: `
<div class="tblwrap"><table><tr><th>#</th><th>레멘토</th><th>온스토리 섹션</th><th>내용 출처</th><th>상태</th></tr>
<tr><td>0</td><td>프로모 띠</td><td>오픈 띠 (14일 무료)</td><td>02 카피</td><td><span class="tag done">완료</span></td></tr>
<tr><td>1</td><td>헤더 Home/How it works/Inside our books/Our story/FAQs/Reviews/Shark Tank/Blog/Log in + Buy now</td><td>로고 · 작동방식 · 사업이야기 · 자주묻는질문 · 리뷰 · 블로그 · 로그인 + [무료로 시작]</td><td>14 메뉴</td><td><span class="tag done">완료</span></td></tr>
<tr><td>2</td><td>히어로</td><td>확정 히어로 + 3배지 + 폰 프레임</td><td>03</td><td><span class="tag done">완료</span></td></tr>
<tr><td>3</td><td>언론 로고 띠</td><td>"한 번 말하면 6곳으로" 채널 6개 로고 띠</td><td>02</td><td><span class="tag done">완료</span></td></tr>
<tr><td>4</td><td>유명인 인용 3개</td><td>서브서브 멘트 4개 카드 (인용 대신 약속)</td><td>02</td><td><span class="tag done">완료</span></td></tr>
<tr><td>5</td><td>What is Remento</td><td>온스토리는 무엇인가요? (3열: 홈페이지 / 60초 영상 / 6채널)</td><td>02</td><td><span class="tag done">완료</span></td></tr>
<tr><td>6</td><td>How it works 4단계</td><td>이렇게 작동합니다 4단계</td><td>08</td><td><span class="tag done">완료</span></td></tr>
<tr><td>7</td><td>(기존 온스토리) 완성 예시 포트폴리오 탭</td><td>실제 작동 중인 사이트 — 그대로 유지</td><td>기존</td><td><span class="tag done">유지</span></td></tr>
<tr><td>8</td><td>Our Story 창업자 편지</td><td>왜 만들었나 — 짧은 편지 + [사업이야기 →]</td><td>09</td><td><span class="tag done">완료</span></td></tr>
<tr><td>9</td><td>Product visuals</td><td>스토리 페이지 들여다보기 (720 스토리 · 1440×810 영상 · 1080×1920 쇼츠 · 464 카드 목업)</td><td>07</td><td><span class="tag done">완료</span></td></tr>
<tr><td>10</td><td>Best-seller $99 카드</td><td>정회원 49,000원 카드 — 포함 6가지 · 14일 무료 · 해지 자유</td><td>02</td><td><span class="tag done">완료</span></td></tr>
<tr><td>11</td><td>Yours forever 3카드</td><td>전부 사장님 것 3카드 (홈페이지·영상·기록)</td><td>02</td><td><span class="tag done">완료</span></td></tr>
<tr><td>12</td><td>Trusted 배너</td><td>(기존) 3단계 "사장님이 할 일은 사진뿐" → "사장님이 할 일은 60초뿐" 로 문구만 갱신</td><td>기존</td><td><span class="tag done">유지</span></td></tr>
<tr><td>13</td><td>Shark Tank 영상</td><td>60초 녹화 데모 — 폰 목업 REC 화면 + 질문 → 자막 영상 미리보기</td><td>07</td><td><span class="tag done">완료</span></td></tr>
<tr><td>14</td><td>후기 캐러셀 7</td><td>(기존) 차별점 3카드 유지 + "이런 사장님께" 3카드 (후기 날조 금지 — 실후기 생기면 교체)</td><td>11</td><td><span class="tag done">완료</span></td></tr>
<tr><td>15</td><td>Speech-to-Story 데모</td><td>말하면 글이 됩니다 — 원문/1인칭/3인칭 3탭</td><td>07</td><td><span class="tag done">완료</span></td></tr>
<tr><td>16</td><td>프롬프트 셔플 위젯</td><td>사장님, 어떤 이야기를 들려주시겠습니까? + [랜덤 질문 바꾸기] 4장</td><td>07</td><td><span class="tag done">완료</span></td></tr>
<tr><td>17</td><td>Still weighing options? 비교 콜아웃</td><td>아직 고민 중이신가요? → 제작업체 vs 온스토리</td><td>13</td><td><span class="tag done">완료</span></td></tr>
<tr><td>18</td><td>고객 스토리 카드 3</td><td>스토리 예시 3 (시작·경험·최근손님 — '예시' 표기)</td><td>07</td><td><span class="tag done">완료</span></td></tr>
<tr><td>19</td><td>Gift scheduling</td><td>14일 무료 흐름 (오늘 시작 → 14일 뒤 결제 → 계속 유지) + (기존) 가격 다크 밴드 유지</td><td>기존</td><td><span class="tag done">완료</span></td></tr>
<tr><td>20</td><td>FAQ 5개 + 뉴스레터</td><td>FAQ 5개 + "사장님 질문 20개 받기" CTA</td><td>10</td><td><span class="tag done">완료</span></td></tr>
<tr><td>21</td><td>푸터 3열 + SNS</td><td>둘러보기 / 회사 / 비교 + 채널 6</td><td>14</td><td><span class="tag done">완료</span></td></tr></table></div>
`},

/* ───────────────────────── 05 레멘토 닮은 온스토리 ───────────────────────── */
{ id: "remento", group: "첫 페이지", title: "레멘토 참고 방침 · 디자인 토큰 · 파일 분류 ①②",
  lead: "109장 캡처 + 실사이트 전 메뉴 클릭 분석 결과. 회장님 확정 방침(09-05 저녁): 레이아웃·섹션 순서·마케팅 흐름·정보 구조는 적극 벤치마킹, 색상은 독자 팔레트(#005B2A/#273D3D), 아이콘·이미지·세부 UI는 유사하되 변형. 내용은 전부 온스토리.",
  html: `
<div class="card lime"><b>방침 확정 (2026-09-05 저녁, CLAUDE.md 규칙 9)</b><br>
① 레이아웃 배치 · 섹션 순서 · 마케팅 흐름 · 정보 구조 — 레멘토를 최대한 가깝게 (적극 벤치마킹)<br>
② 색상 — 레멘토와 다르게. <b>메인 #005B2A</b>(초록, 로고 ON) · <b>서브 #273D3D</b>(진한 초록). 레멘토의 포레스트 #1E332D · 크림 #F4F0E6 · 라임 #E1EB6E 조합은 쓰지 않는다<br>
③ 아이콘 스타일 · 이미지 처리 · 세부 UI — 뉘앙스만 비슷하게, 베낀 티가 나지 않을 만큼 변형</div>

<h3>디자인 토큰 (방침 반영 — app/globals.css 가 단일 출처)</h3>
<table><tr><th>역할</th><th>레멘토</th><th>09-05 1차본 (조정 전)</th><th>확정 팔레트 (조정 후)</th><th>CSS 변수</th></tr>
<tr><td>메인(버튼·강조·링크)</td><td>라임 #E1EB6E 알약</td><td>라임 그대로</td><td><b>#005B2A</b> 초록 + 흰 글자, 모서리 12px(알약 아님)</td><td><code>--green</code></td></tr>
<tr><td>서브(밴드·푸터·다크 화면)</td><td>포레스트 #1E332D</td><td>#1E332D 그대로</td><td><b>#273D3D</b> 진한 초록</td><td><code>--forest</code>(값만 교체)</td></tr>
<tr><td>바탕</td><td>크림 #F4F0E6</td><td>크림 그대로</td><td>흰색 #FFFFFF / 연회색 #F5F7F6 (크림 아님)</td><td><code>--paper</code> <code>--cream</code></td></tr>
<tr><td>연한 초록 면(배지·소프트 카드)</td><td>—</td><td>라임 띠</td><td>#005B2A 8% 틴트 #E8F1EC</td><td><code>--accent-soft</code></td></tr>
<tr><td>강조(REC·경고)</td><td>테라코타 #C4553A</td><td>테라코타</td><td>#D64545 (일반 적색 — 특정 브랜드 색 회피)</td><td><code>--terra</code></td></tr>
<tr><td>보조 텍스트</td><td>틸 #4C7C74</td><td>틸</td><td>#4F6B62 (서브색 파생)</td><td><code>--teal</code></td></tr>
<tr><td>제목 서체</td><td>세리프</td><td>Noto Serif KR</td><td>유지하되 무게·크기 다르게 (세리프는 일반 관행)</td><td><code>--display</code></td></tr>
<tr><td>본문</td><td>산세리프</td><td>Pretendard</td><td>Pretendard 유지</td><td>—</td></tr>
<tr><td>버튼 형태</td><td>999px 알약</td><td>알약</td><td>12px 라운드 사각</td><td><code>.btn-*</code></td></tr>
<tr><td>카드 모서리</td><td>12~16px</td><td>16~24px</td><td>12px + 얇은 초록 상단선(변형)</td><td>—</td></tr>
<tr><td>상단 프로모 띠</td><td>라임 띠</td><td>라임 띠</td><td>서브색 #273D3D 얇은 띠 + 흰 글자</td><td><code>PromoBar</code></td></tr>
<tr><td>폰 목업</td><td>검정 폰 + 포레스트 화면</td><td>동일 톤</td><td>연회색 베젤 + 서브색 화면, REC 점만 적색</td><td><code>RecMockup</code></td></tr>
<tr><td>사진</td><td>실제 따뜻한 인물 사진</td><td>—</td><td>이미지뱅크 + 실제 사장님 사진, 모서리 12px·초록 캡션 띠</td><td>—</td></tr></table>

<h3>68개 파일 분류 — ① 사업 로직(그대로 유지) / ② 시각 디자인(방침대로 조정)</h3>
<table><tr><th>구분</th><th>파일</th><th>비고</th></tr>
<tr><td rowspan="9"><b>① 사업 로직<br>(손대지 않음)</b></td><td>lib/trial.ts · lib/story-link.ts · lib/storage.ts · lib/notify.ts · lib/site-owner.ts · lib/sites.ts · lib/generate.ts</td><td>14일·서명·업로드·문자·소유권·로고·생성</td></tr>
<tr><td>app/api/billing/checkout · confirm · app/api/cron/expire · vercel.json</td><td>결제·만료 크론</td></tr>
<tr><td>app/api/generate · api/site/get · api/site/logo · api/place-search · api/story/send-link · upload-url · upload · submit</td><td>온보딩·녹화 API</td></tr>
<tr><td>app/mainplan/[[...path]]/route.ts · next.config.ts · supabase/migrations/20260905090000 · .env.example</td><td>라우트·트레이싱·DB</td></tr>
<tr><td>config/questions.ts · faq.ts · industry-picker.ts · palettes.ts</td><td>질문 은행·FAQ·세부 업종·고객 사이트 8색(브랜드색 아님)</td></tr>
<tr><td>app/admin/members/page.tsx · app/admin/page.tsx · app/billing/success/* · fail · app/my/page.tsx · app/sitemap.ts · app/layout.tsx</td><td>운영자·결제 결과·마이페이지·메타</td></tr>
<tr><td>app/[slug]/edit/ui.tsx(무료 바·차단·모달 배선) · app/[slug]/edit/story-link.tsx · app/[slug]/page.tsx(로고 표시)</td><td>에디터·고객 사이트 로직</td></tr>
<tr><td>app/new/page.tsx · app/new/wizard.tsx 의 단계 흐름·검증·API 호출</td><td>온보딩 5단계 (색·버튼만 ②)</td></tr>
<tr><td>CLAUDE.md · docs/DECISIONS.md · docs/PLAN.md · content/mainplan/* · content/plandept/index.html · scripts/build-plandept.ts · public/brand/*</td><td>문서·기획실·로고(로고는 그대로)</td></tr>
<tr><td rowspan="6"><b>② 시각 디자인<br>(방침대로 조정)</b></td><td><b>app/globals.css</b></td><td>토큰 교체 — 여기만 바꿔도 80% 반영: --green 메인, --forest→#273D3D, 크림→흰/연회색, 라임 폐기, 버튼 알약→12px</td></tr>
<tr><td>components/site/chrome.tsx (헤더·프로모 띠·푸터·PageHero·CtaBand) · blocks.tsx (채널 띠·RecMockup·말→글·비교 콜아웃·FAQ) · question-shuffle.tsx · pay-modal.tsx</td><td>라임 CTA·크림 배경·알약·목업 톤·카드 모서리</td></tr>
<tr><td>app/page.tsx (20섹션 색·밴드·카드) · how-it-works · our-story · faq · reviews · blog · compare</td><td>섹션 배치는 유지, 색·세부 UI만</td></tr>
<tr><td>app/new/wizard.tsx (진행 바·칩·미리보기 카드·버튼 색) · app/rec/[slug]/rec-client.tsx · page.tsx (다크 화면 = 서브색, REC 적색)</td><td>흐름·검증 로직은 손대지 않음</td></tr>
<tr><td>content/mainplan/index.html · content/plandept/index.html · scripts/build-plandept.ts 의 기획1·2·3 버튼 색</td><td>내부 화면 — 라임 → 메인 초록 (선택)</td></tr>
<tr><td>코드 주석의 "레멘토 1:1" 표현 (page.tsx·chrome.tsx·rec-client.tsx 상단)</td><td>"레이아웃 참고·색 독자" 로 문구 정리</td></tr></table>
<p class="note">조정 순서: globals.css 토큰 → chrome/blocks 부품 → 첫 페이지 → 메뉴 6 → 위저드·녹화 → 내부 화면. 각 단계마다 빌드·캡처로 확인. 사업 로직 파일은 diff 0 이 조건.</p>

<h3>로고</h3>
<p>ONSTORI 워드마크(ON 그린 #005B2A + STORI 다크 #192C2C). <code>public/brand/onstori-logo.png</code>(투명 1170×202), 헤더 600px판, 어두운 배경용 크림판. 헤더 높이 28px, 푸터 22px.</p>

<h3>메뉴 구조 대응</h3>
<table><tr><th>레멘토</th><th>온스토리</th><th>경로</th></tr>
<tr><td>Home</td><td>로고</td><td>/</td></tr>
<tr><td>How it works</td><td>작동방식</td><td>/how-it-works</td></tr>
<tr><td>Inside our books</td><td>(첫 페이지 '스토리 페이지 들여다보기' 섹션으로 흡수)</td><td>/#inside</td></tr>
<tr><td>Our story</td><td>사업이야기</td><td>/our-story</td></tr>
<tr><td>FAQs</td><td>자주묻는질문</td><td>/faq</td></tr>
<tr><td>Reviews</td><td>리뷰</td><td>/reviews</td></tr>
<tr><td>Remento on Shark Tank</td><td>(없음 — 60초 데모 섹션이 대신)</td><td>—</td></tr>
<tr><td>Blog</td><td>블로그</td><td>/blog</td></tr>
<tr><td>Log in</td><td>로그인 / 마이페이지</td><td>/login · /my</td></tr>
<tr><td>Buy now (라임)</td><td>무료로 시작 (라임)</td><td>/new</td></tr>
<tr><td>Remento vs Storyworth</td><td>홈페이지 제작업체 vs 온스토리</td><td>/compare</td></tr></table>

<h3>마케팅 장치 대응</h3>
<table><tr><th>레멘토</th><th>온스토리</th></tr>
<tr><td>선물(Gift) 프레이밍 — 부모님께 드리는 선물</td><td>14일 무료 — "사장님 이야기부터 들려주세요". 선물 대상은 사장님 자신(미래의 손님).</td></tr>
<tr><td>연말 책(Book) 실물</td><td>홈페이지에 쌓이는 이야기 + 6채널 영상. 실물 대신 '3년 뒤에도 검색되는 기록'.</td></tr>
<tr><td>주간 프롬프트 이메일</td><td>주간 질문 문자(솔라피) — 링크 하나. 카톡 알림톡은 후순위.</td></tr>
<tr><td>Speech-to-Story</td><td>말→글 가공 3모드(원문·1인칭·3인칭) + 캡션 6종</td></tr>
<tr><td>프롬프트 셔플 위젯</td><td>랜덤 질문 바꾸기 4장 — 첫 페이지·작동방식·에디터·녹화 화면 모두 동일 컴포넌트</td></tr>
<tr><td>Trustpilot 1,500+ 리뷰</td><td>실사용 후기 수집 전까지 숫자 미표시. 리뷰 페이지는 '받은 후기'만, 별점 입력 없음(규칙 7)</td></tr>
<tr><td>vs Storyworth 비교표 11행</td><td>vs 제작업체 비교표 11행</td></tr>
<tr><td>20 questions 리드 매그닛</td><td>사장님 질문 20개 PDF/문자 — 이메일·전화 수집</td></tr>
<tr><td>Exit-intent $10 팝업</td><td>이탈 시 "14일 무료로 먼저 써보세요" 팝업 (후순위)</td></tr>
<tr><td>Refer a friend / Gift</td><td>동네 사장님 소개하기 (후순위)</td></tr></table>

<h3>레멘토 녹화 흐름 → 온스토리 /rec</h3>
<div class="flow"><span>문자 도착</span><i>→</i><span>링크 탭 (크롬 열림)</span><i>→</i><span>인사 화면 "안녕하세요 사장님"</span><i>→</i><span>오늘의 질문 (질문 바꾸기)</span><i>→</i><span>영상/음성 선택</span><i>→</i><span>카메라·마이크 허용</span><i>→</i><span>3·2·1</span><i>→</i><span>REC 0:00/1:00 일시정지·정지</span><i>→</i><span>확인 · 다시 찍기 · 보내기</span><i>→</i><span>"보냈어요. 자막 영상은 30분 뒤 문자로"</span></div>
<p class="note">레멘토는 최대 30분, 온스토리는 60초 고정(쇼츠·릴스 규격). 얼굴 안 나와도 되는 '음성만' 모드는 이미지뱅크 사진 + 자막으로 영상을 만든다.</p>
`},

/* ───────────────────────── 06 기능 구현 계획안 ───────────────────────── */
{ id: "plan", group: "구현", title: "기능 구현 계획안 (작업 순서 · 파일 · 준비물)",
  lead: "마스터플랜 STEP 0~8을 이번 세션 결과에 맞춰 갱신. 각 STEP은 '완료 조건'이 있어야 끝난다.",
  html: `
<table><tr><th>STEP</th><th>작업</th><th>파일</th><th>준비물</th><th>완료 조건</th><th>상태</th></tr>
<tr><td>0</td><td>기획실 3개 + 첫 페이지 + 메뉴 페이지 + 질문 위젯</td><td>content/mainplan, app/page.tsx, app/(메뉴)/*, components/site/*</td><td>로고 PNG, 확정 카피</td><td>onstori.com 첫 화면이 레멘토 구조로 보인다</td><td><span class="tag done">완료</span></td></tr>
<tr><td>1</td><td>온보딩 5단계 + 14일 + 결제 화면 + 회원목록</td><td>app/new/*, api/generate, api/billing/*, admin/members, lib/trial.ts</td><td>네이버/카카오 API 키(선택), 토스 키(가맹 후)</td><td>새 사장님이 5단계로 사이트를 만들고 D-14가 보인다</td><td><span class="tag done">완료(키 대기)</span></td></tr>
<tr><td>2</td><td>마이그레이션 적용 (사람)</td><td>supabase/migrations/20260905090000_*.sql</td><td>supabase db push</td><td>reserved_slugs에 mainplan 등, sites.paid_at, story_entries.video_key 존재</td><td><span class="tag wip">회장님/클코팀장</span></td></tr>
<tr><td>3</td><td>60초 녹화 + 업로드 + 문자 링크</td><td>app/rec/*, api/story/*, lib/story-link.ts</td><td>R2 env 6개(있음), 솔라피(있음)</td><td>내 폰 크롬에서 60초 찍고 R2에 파일이 생기고 story_entries 행이 생긴다</td><td><span class="tag done">1차 완료</span></td></tr>
<tr><td>4</td><td>자막·컷편집 워커</td><td>worker/ (Cloud Run, ffmpeg+AssemblyAI)</td><td>GCP Cloud Run, AssemblyAI 키, 한글 폰트</td><td>업로드 30분 내 1080×1920 자막 영상 URL이 story_entries에 채워진다</td><td><span class="tag todo">클코팀장</span></td></tr>
<tr><td>5</td><td>말→글 가공 + 스토리 카드</td><td>lib/story-text.ts, api/story/card (@vercel/og), lib/bank.ts role='story'</td><td>Gemini(있음), 뱅크</td><td>한 녹화에서 글 3종 + 캡션 6종 + 카드 1장이 나온다</td><td><span class="tag todo">클코팀장</span></td></tr>
<tr><td>6</td><td>홈페이지 블로그 + 네이버 복붙 화면</td><td>app/[slug]/story/[id], 에디터 '복사' 버튼</td><td>—</td><td>사장님이 복사 버튼 → 네이버 블로그에 30초 안에 붙인다</td><td><span class="tag todo">클코팀장</span></td></tr>
<tr><td>7</td><td>인스타·쓰레드·유튜브·X 발행</td><td>lib/publish/*.ts, api/publish/*</td><td>Meta 앱 리뷰(20일), 유튜브 감사, X 유료</td><td>버튼 한 번에 4곳 발행, 하루 3건 상한</td><td><span class="tag todo">승인 대기</span></td></tr>
<tr><td>8</td><td>이미지뱅크 생성기 어드민</td><td>app/admin/bank/generate, scripts/bank-generate.ts 재사용</td><td>Vertex 크레딧 40만원</td><td>키워드+숫자+버튼 → 1,000장이 별점과 함께 들어온다</td><td><span class="tag todo">클코팀장</span></td></tr></table>

<h3>클코팀장 세션 프롬프트 (STEP 4 예시)</h3>
<pre>읽을 파일: content/mainplan/data.js(#plan, #core), lib/storage.ts, supabase/migrations/20260905090000_mainplan_membership.sql
할 일: story_entries.video_key 가 채워지면 Cloud Run 워커가 ①AssemblyAI 단어 타임스탬프 ②무음 컷(150~250ms 패딩)
③어절 단위 자막(한글 폰트 임베드, libass 중간 끊김 회피) ④1080×1920 출력 → R2 → story_entries.video_out_key.
완료 조건: 테스트 영상 1개가 30분 내 처리된다. 한 세션 = 이 작업 하나.</pre>
`},

/* ───────────────────────── 07 핵심 기능 구현 ───────────────────────── */
{ id: "core", group: "구현", title: "핵심 기능 구현 (글쓰기 금지 · 링크만 · 다운로드 없음)",
  lead: "세 원칙을 기술로 어떻게 지키는지. 그리고 60초가 6곳으로 가는 길.",
  html: `
<div class="grid3">
  <div class="card"><b>✎ 글쓰기 금지</b><p>사장님은 타이핑하지 않는다. 질문은 온스토리가 문자로 보내고, 답은 말로 한다. 직접 쓴 글도 반드시 AI 가공을 거친다(원문 보존 + 다듬은 판).</p></div>
  <div class="card"><b>🔗 문자 링크만 누르세요</b><p>솔라피 문자에 <code>onstori.com/rec/{slug}?k=서명</code>. 서명은 HMAC(slug+주차)라 DB 없이 검증. 카톡 인앱은 녹화가 안 되므로 "크롬으로 열기" 안내 1줄. 링크를 여는 것이 곧 로그인.</p></div>
  <div class="card"><b>⤓ 다운로드 없음</b><p>앱 설치 없음. 브라우저 MediaRecorder(webm/mp4) 60초 → R2 presigned PUT(브라우저→R2 직접, Vercel 4.5MB 한도 우회). 결과물도 링크로만 받는다.</p></div>
</div>

<h3>질문 시스템</h3>
<div class="card"><b>사장님, 어떤 이야기를 들려주시겠습니까?</b> <span class="pill" style="padding:6px 12px;font-size:13px">랜덤 질문 바꾸기</span>
<div class="grid2" style="margin-top:10px">
<div class="q"><small>시작이야기</small>이 일을 처음 시작하던 날, 무엇이 가장 두려웠나요?</div>
<div class="q"><small>경험이야기</small>가장 힘들었던 작업(주문)은 무엇이었고 어떻게 해결했나요?</div>
<div class="q"><small>최근손님이야기</small>이번 주에 온 손님 중 기억에 남는 한 분은요?</div>
<div class="q"><small>나만의스토리</small>다른 곳과 다르게 우리만 고집하는 게 하나 있다면?</div></div>
<p class="note">질문 은행 100개 = 5카테고리(시작·경험·나만의·실적·최근손님) × 20. <code>config/questions.ts</code> 단일 출처. 한 번에 4장, 바꾸기 누르면 새 4장, 하나를 고르면 녹화 화면으로. 이미 답한 질문은 제외.</p></div>

<h3>60초 → 6곳 파이프라인</h3>
<div class="flow"><span>/rec 녹화 (60s)</span><i>→</i><span>R2 private (원본)</span><i>→</i><span>워커: STT 단어 타임스탬프 → 무음 컷 → 어절 자막 → 1080×1920</span><i>→</i><span>Gemini: 원문·1인칭·3인칭·캡션 6종·해시태그</span><i>→</i><span>뱅크 사진 3장 추천(별점·태그 일치·랜덤) → 스토리 카드</span><i>→</i><span>발행: 쇼츠 · 릴스 · 쓰레드 · X(유료) · 네이버(복붙) · 홈페이지 블로그</span></div>
<table><tr><th>채널</th><th>방식</th><th>규격</th><th>비용/제약</th></tr>
<tr><td>유튜브 쇼츠</td><td>Data API videos.insert</td><td>1080×1920 ≤60s</td><td>100회/일, 감사 통과 전 비공개. '비진정성 콘텐츠' 정책 → 사장님 촬영본·본인 목소리 필수</td></tr>
<tr><td>인스타 릴스</td><td>Graph API (Reels)</td><td>1080×1920</td><td>무료. 앱 리뷰 20일 + 비즈니스 인증</td></tr>
<tr><td>쓰레드</td><td>Threads API</td><td>글 500자 + 영상/사진</td><td>무료. 동일 앱 리뷰</td></tr>
<tr><td>X</td><td>API v2 (유료 고객만)</td><td>글 280자 + 영상</td><td>$0.015/건, 링크 시 $0.20 → 링크 없이</td></tr>
<tr><td>네이버 블로그</td><td>복붙 (API 없음)</td><td>글 1,000자 + 사진 3장 + 영상 링크</td><td>복사 버튼 1개 + 30초 안내. 저품질 회피: 매번 다른 문체·사진</td></tr>
<tr><td>온스토리 홈페이지</td><td>story_entries → /[slug] 스토리 피드 + /[slug]/story/[id]</td><td>720px 스토리 페이지</td><td>무료. 검색 인덱싱의 본진</td></tr></table>

<h3>레이아웃 규격 (확정)</h3>
<ul><li>스토리 페이지 720px 폭 — 제목 · 날짜 · 카테고리 · 영상(16:9) · 다듬은 글 · 사진 3장 · 원문 접기</li>
<li>영상 가로 1440×810(홈페이지·유튜브) / 세로 1080×1920(쇼츠·릴스)</li>
<li>스토리 카드 464×464(인스타·쓰레드 사진) — 뱅크 사진 위 질문 + 한 줄 답</li>
<li>"직접 찍은 사진으로 넣으시면 이야기에 신뢰가 쌓입니다" — 사진 고르기 화면 상단 고정 문구</li></ul>

<h3>이야기 엔진 프로토타입 v4 (설득용 실물)</h3>
<iframe class="proto" src="/mainplan/docs/story-engine-proto-final-2026-09-05.html" title="이야기 엔진 프로토타입 v4"></iframe>
`},

/* ───────────────────────── 08 작동방식 ───────────────────────── */
{ id: "howitworks", group: "메뉴 페이지", title: "작동방식 (/how-it-works 전문)",
  lead: "레멘토 How it works 구조: 히어로 → 6단계 타임라인 → 말→글 3모드 → 질문 위젯 → 녹화 미리보기 → CTA.",
  html: `
<h3>히어로</h3><p><b>사장님이 말하면, 손님이 찾아옵니다.</b><br>글쓰기·편집·앱 설치 없이, 문자 링크 하나로 매주 60초.</p>
<h3>6단계 타임라인</h3>
<ol>
<li><b>홈페이지가 먼저 생깁니다 (오늘, 3분)</b> — 상호명과 업종만 고르면 온스토리가 문구·사진·구조를 채워 <code>onstori.com/사장님가게</code>를 만듭니다. 14일 동안 전 기능 무료.</li>
<li><b>매주 질문이 문자로 옵니다</b> — "이 일을 시작한 이유는요?" 같은 질문 4개 중 하나. 마음에 안 들면 [랜덤 질문 바꾸기].</li>
<li><b>링크를 누르고 60초 말합니다</b> — 크롬이 열리고 3·2·1 뒤 녹화. 얼굴이 싫으면 '음성만'. 다시 찍기는 무제한.</li>
<li><b>온스토리가 영상·글·사진 카드를 만듭니다 (30분)</b> — 무음 컷 · 한글 자막 · 세로/가로 두 판 · 원문/1인칭/3인칭 글 · 캡션 6종 · 사진 카드.</li>
<li><b>6곳에 퍼집니다</b> — 유튜브 쇼츠 · 인스타 릴스 · 쓰레드 · X(유료) · 네이버 블로그(복사 30초) · 온스토리 홈페이지 블로그. 하루 최대 3건.</li>
<li><b>홈페이지에 쌓입니다</b> — 이야기가 늘수록 검색에 잡히는 페이지가 늘고, "작업 기록 47건"이 말이 아니라 기록으로 증명됩니다.</li></ol>
<h3>말→글 3모드 (샘플)</h3>
<table><tr><th>원문(그대로)</th><th>1인칭 다듬기</th><th>3인칭 소개</th></tr>
<tr><td>"어… 저는 원래 아버지가 도배를 하셨는데요, 그… 처음엔 안 하려고 했어요. 근데 군대 갔다 와서 딱히… 그래서 따라다니다 보니까 벌써 12년이네요."</td><td>"원래 아버지가 도배를 하셨습니다. 처음엔 이 길을 갈 생각이 없었어요. 군대를 다녀와 아버지를 따라다니기 시작했는데, 그게 벌써 12년이 됐습니다."</td><td>"사장님은 도배를 하시던 아버지 곁에서 일을 배웠습니다. 처음엔 물려받을 생각이 없었지만, 아버지를 따라다닌 시간이 어느새 12년이 되었습니다."</td></tr></table>
<p class="note">규칙: 입력에 없는 연차·건수·자격은 절대 만들지 않는다(기존 카피 규칙 그대로). 사장님이 말한 숫자만 쓴다.</p>
<h3>질문 위젯</h3><p>첫 페이지와 동일 컴포넌트. 4장 · 랜덤 질문 바꾸기 · 카드 클릭 → /new.</p>
<h3>녹화 미리보기</h3><p>다크 배경에 폰 목업: 질문 카드 → REC 0:00/1:00 → "보냈어요". 실제 /rec 화면과 같은 부품.</p>
<h3>CTA</h3><p>[녹화를 시도해보세요 · 60초] → /new · "14일 전 기능 무료 · 이후 49,000원 · 언제든 해지"</p>
`},

/* ───────────────────────── 09 사업이야기 ───────────────────────── */
{ id: "ourstory", group: "메뉴 페이지", title: "사업이야기 (/our-story 전문)",
  lead: "레멘토 Our story 구조: 창업자 편지 → 이정표 타임라인 → 원칙. 사실이 아닌 개인 이력은 쓰지 않는다 — 회장님이 문장 단위로 교정 가능.",
  html: `
<h3>창업자 편지 (초안 — 회장님 교정용)</h3>
<div class="card">
<p>사장님께,</p>
<p>홈페이지를 만들어 드리는 일을 하면서 한 가지가 계속 걸렸습니다. 홈페이지는 있는데 손님이 없는 가게가 너무 많다는 것입니다. 사진은 예쁘고 문구도 그럴듯한데, 그 안에 사람이 없었습니다. 손님은 상품이 아니라 사람을 믿는데 말입니다.</p>
<p>사장님들은 글을 쓰기 싫어하십니다. 시간이 없고, 뭘 써야 할지 모르겠고, 써 봤자 아무도 안 읽을 것 같으니까요. 그런데 말은 잘하십니다. 손님 앞에서, 전화로, 현장에서 매일 이야기를 하십니다. 그 말을 그대로 기록으로 바꿔 드리면 어떨까 — 온스토리는 거기서 시작했습니다.</p>
<p>온스토리는 사장님께 글을 쓰라고 하지 않습니다. 질문을 드리고, 60초만 말씀해 달라고 합니다. 그 60초를 자막 영상과 글과 사진으로 만들어 유튜브·인스타·네이버·그리고 사장님 홈페이지에 쌓습니다. 3년 뒤에도 검색되는 사장님의 기록이 됩니다.</p>
<p>홈페이지는 텅 빈 상가입니다. 스토리에는 진짜 사람이 있습니다. 사장님의 이야기부터 들려주세요.</p>
<p>— 온스토리 대표 권병철</p></div>
<h3>이정표 (6개 — 사실만)</h3>
<table><tr><th>시기</th><th>이정표</th></tr>
<tr><td>2026.08</td><td>onstori.com 도메인 · 저장소 · 설계서 v1</td></tr>
<tr><td>2026.08.31</td><td>첫 고객 사이트가 DB에서 렌더링됨 (P1)</td></tr>
<tr><td>2026.09.01</td><td>AI 생성 파이프라인 · 이미지뱅크 638장 · 에디터 · 카카오/이메일 로그인 (P2~P4)</td></tr>
<tr><td>2026.09.04</td><td>견적 문의 접수·알림 프로덕션 검증 · R2 저장소 전환</td></tr>
<tr><td>2026.09.05</td><td>'이야기 엔진'으로 전환 결정 — 60초 녹화 · 6채널 · 레멘토 구조</td></tr>
<tr><td>다음</td><td>첫 사장님 10명 무료 14일 · 첫 60초 영상 · 첫 결제</td></tr></table>
<h3>원칙 5개</h3>
<ol><li>사장님은 글을 쓰지 않는다.</li><li>없는 사실을 만들지 않는다 — 연차·건수·후기·별점을 지어내지 않는다.</li><li>사장님이 찍은 것이 우선이다. AI 사진은 빈자리를 채울 뿐이다.</li><li>홈페이지·영상·기록은 전부 사장님 것이다. 해지해도 가져간다.</li><li>가격은 처음부터 공개한다. 14일 무료, 이후 49,000원.</li></ol>
`},

/* ───────────────────────── 10 FAQ ───────────────────────── */
{ id: "faq", group: "메뉴 페이지", title: "자주묻는질문 (/faq 전문 · 7분류)",
  lead: "레멘토 FAQ 7분류(About · 요금 · 녹화 · 맞춤 · 결과물 · 선물 · 개인정보)를 온스토리 분류로. 전체 문답은 config/faq.ts 가 단일 출처.",
  html: `
<h3>1. 온스토리란</h3>
<p><b>온스토리가 뭔가요?</b> — 사장님의 60초 이야기를 홈페이지·자막 영상·글·사진 카드로 만들어 6곳에 퍼뜨리는 서비스입니다. 홈페이지는 3분 만에 먼저 생깁니다.</p>
<p><b>홈페이지 제작업체와 뭐가 다른가요?</b> — 제작업체는 홈페이지를 만들고 끝납니다. 온스토리는 매주 질문을 보내고, 사장님의 대답을 콘텐츠로 만들어 손님이 찾아오게 합니다. <a href="#/compare">비교표</a>.</p>
<p><b>글을 정말 안 써도 되나요?</b> — 네. 문자로 온 링크를 누르고 말씀만 하시면 됩니다. 직접 쓰고 싶으시면 써도 되고, 그것도 AI가 다듬어 드립니다.</p>
<p><b>어떤 업종이 쓸 수 있나요?</b> — 시공·출장(인테리어·도배·타일·전기·설비·청소·이사 등), 카페·식당, 미용·뷰티, 학원·레슨, 병원·상담, 공방·제작 등. 쇼핑몰은 지원하지 않습니다.</p>
<h3>2. 요금 · 정회원</h3>
<p><b>얼마인가요?</b> — 14일 동안 전 기능 무료. 14일 안에 정회원(49,000원)으로 전환하시면 홈페이지가 계속 유지됩니다. 14일이 지나면 자동으로 삭제됩니다.</p>
<p><b>14일 뒤에 결제 안 하면요?</b> — 홈페이지와 이야기가 비공개로 바뀌고, 이후 삭제됩니다. 삭제 전 문자로 두 번 안내드립니다.</p>
<p><b>정회원에 뭐가 포함되나요?</b> — 홈페이지 유지 · 주간 질문 · 60초 영상 제작 · 글·사진 카드 · 6채널 발행 · 문의 알림. X 발행은 유료 회원 전용입니다.</p>
<p><b>해지하면 자료는요?</b> — 영상·글·사진은 사장님 것입니다. 해지 전 전부 내려받으실 수 있습니다.</p>
<h3>3. 녹화</h3>
<p><b>앱을 설치해야 하나요?</b> — 아니요. 문자 링크를 크롬에서 열면 바로 녹화됩니다. 카카오톡 안에서 열리면 "크롬으로 열기"를 눌러 주세요(카톡 안에서는 카메라가 안 켜집니다).</p>
<p><b>얼굴이 나와야 하나요?</b> — 아니요. '음성만'을 고르시면 목소리 + 사진 + 자막으로 영상을 만듭니다.</p>
<p><b>60초가 넘으면요?</b> — 60초에 자동으로 멈춥니다. 쇼츠·릴스 규격에 맞추기 위해서입니다. 더 하실 말씀은 다음 주 질문으로 이어집니다.</p>
<p><b>말을 더듬거나 "어…"가 많아도 되나요?</b> — 됩니다. 무음과 군더더기를 잘라 드립니다. 다만 사장님 목소리 그대로가 원칙입니다 — AI 목소리로 바꾸지 않습니다.</p>
<p><b>다시 찍을 수 있나요?</b> — 보내기 전엔 무제한. 보낸 뒤에도 '다시 찍기'를 요청하실 수 있습니다.</p>
<h3>4. 질문 · 맞춤</h3>
<p><b>질문은 누가 정하나요?</b> — 온스토리 질문 은행 100개(시작·경험·나만의·실적·최근손님 5가지)에서 4개씩 드립니다. [랜덤 질문 바꾸기]로 얼마든지 바꾸실 수 있고, 직접 주제를 적어도 됩니다.</p>
<p><b>주 몇 번 오나요?</b> — 기본 주 1회. 원하시면 매일도 가능하고, 하루 최대 3건까지 발행됩니다.</p>
<p><b>업종·색·로고를 바꿀 수 있나요?</b> — 네. 에디터에서 언제든. 로고는 직접 올리거나 온스토리가 만든 4안 중 고르실 수 있습니다.</p>
<h3>5. 결과물 · 발행</h3>
<p><b>어디에 올라가나요?</b> — 유튜브 쇼츠 · 인스타 릴스 · 쓰레드 · X(유료) · 네이버 블로그(복사 30초) · 온스토리 홈페이지 블로그.</p>
<p><b>네이버 블로그는 왜 복사인가요?</b> — 네이버는 자동 게시 API를 열어 두지 않았습니다. 복사 버튼 한 번 → 붙여넣기 30초입니다. 매번 문체와 사진을 달리해 저품질을 피합니다.</p>
<p><b>유튜브 채널이 없어요.</b> — 만드는 것까지 안내해 드립니다(채널 생성은 API로 불가능해 사장님이 3분 직접). 인스타·쓰레드가 없으면 온스토리가 개설을 도와드립니다.</p>
<p><b>AI가 만든 영상인가요?</b> — 사장님이 찍고 말한 영상에 자막과 컷 편집만 합니다. AI 아바타·AI 목소리·AI 생성 영상은 쓰지 않습니다(유튜브 정책상 사장님에게 불리합니다).</p>
<h3>6. 홈페이지</h3>
<p><b>주소는요?</b> — onstori.com/사장님가게. 네이버·구글 검색 등록을 온스토리가 준비합니다.</p>
<p><b>문의는 어떻게 받나요?</b> — 홈페이지 문의 폼 → 사장님 문자·이메일로 60초 안에 알림.</p>
<p><b>네이버 플레이스 정보를 가져올 수 있나요?</b> — 상호명으로 검색해 이름·업종·주소·전화를 채워 드립니다. 영업시간·사진·소개는 직접 입력하셔야 합니다(네이버가 열어 두지 않았습니다).</p>
<h3>7. 개인정보 · 보안</h3>
<p><b>영상 원본은 어디에 있나요?</b> — 비공개 저장소(Cloudflare R2)에 있고, 발행한 것만 공개됩니다.</p>
<p><b>로그인 방식은요?</b> — 카카오 또는 이메일 인증번호. 비밀번호를 만들지 않습니다.</p>
<p><b>손님 후기에 별점이 없는 이유는요?</b> — 표시광고법 방침으로 별점·평점 입력 기능을 두지 않습니다. 후기는 글로만 남깁니다.</p>
`},

/* ───────────────────────── 11 리뷰 ───────────────────────── */
{ id: "reviews", group: "메뉴 페이지", title: "리뷰 (/reviews 구조 · 정직 원칙)",
  lead: "레멘토 리뷰 페이지 구조(태그 필터 · 카드 · 외부 신뢰 임베드)를 그대로 쓰되, 지금은 실후기가 없다. 없는 후기를 만들지 않는다.",
  html: `
<h3>구조</h3>
<ul><li>상단: "사장님들의 이야기" + 태그 필터 [전체] [시공·출장] [카페·식당] [뷰티] [교육] [기타]</li>
<li>카드: 상호명 · 업종 · 지역 · 후기 본문 · 사이트 링크 · (별점 없음 — 규칙 7)</li>
<li>하단: "첫 14일을 써 보신 사장님의 이야기를 기다립니다" + [무료로 시작]</li>
<li>외부 신뢰: 트러스트파일럿 대신 네이버 플레이스 리뷰/유튜브 채널 링크 카드(있을 때)</li></ul>
<h3>지금 화면 (실후기 0건)</h3>
<p>후기 카드 자리에 "이런 사장님께" 3카드(페르소나 — 후기가 아님을 명시)와, 첫 10명 사장님 모집 안내를 둔다. 실후기가 1건이라도 생기면 카드가 그 자리를 채운다.</p>
<h3>후기 수집 방식</h3>
<ol><li>정회원 전환 7일 뒤 문자 1회: "한 줄만 남겨 주시면 리뷰 페이지에 사장님 가게 링크와 함께 올립니다."</li><li>60초 녹화 질문 은행에 "온스토리를 써 보니 어떠셨어요?"를 실적이야기 카테고리로 포함 → 영상 후기.</li><li>후기는 사장님 승인 후 게시, 언제든 내릴 수 있음.</li></ol>
`},

/* ───────────────────────── 12 블로그 ───────────────────────── */
{ id: "blog", group: "메뉴 페이지", title: "블로그 (/blog 구조 · 6분류 · 첫 12편)",
  lead: "레멘토 블로그: 6카테고리 · 카드 그리드 · 리드 매그닛. 온스토리 블로그는 두 층 — 본사 블로그(여기)와 사장님 각자의 홈페이지 블로그.",
  html: `
<h3>6분류</h3>
<table><tr><th>레멘토</th><th>온스토리</th><th>목적</th></tr>
<tr><td>Family stories</td><td>사장님 이야기</td><td>실제 사장님 영상·글 큐레이션 (검색 유입)</td></tr>
<tr><td>Prompts & questions</td><td>질문 은행</td><td>"사장님이 답하기 좋은 질문 20개" 류 — 리드 매그닛과 연결</td></tr>
<tr><td>Gift guides</td><td>업종별 가이드</td><td>"도배 사장님 홈페이지에 꼭 있어야 할 5가지"</td></tr>
<tr><td>Memory keeping</td><td>검색·유튜브 노하우</td><td>쇼츠·릴스·네이버 저품질 회피</td></tr>
<tr><td>Company news</td><td>온스토리 소식</td><td>기능 업데이트·정책</td></tr>
<tr><td>Interviews</td><td>사장님 인터뷰</td><td>롱폼 (분기 1편)</td></tr></table>
<h3>첫 12편 (제목 · 요약)</h3>
<ol>
<li><b>홈페이지는 있는데 손님이 없는 이유</b> — 텅 빈 상가론. 사람이 없는 페이지는 검색도 신뢰도 안 쌓인다.</li>
<li><b>사장님이 답하기 좋은 질문 20개</b> — 시작·경험·나만의·실적·최근손님 5분류 × 4.</li>
<li><b>60초 영상이 3년 뒤에도 검색되는 이유</b> — 쇼츠·릴스의 롱테일과 홈페이지 스토리 페이지의 관계.</li>
<li><b>얼굴 없이 영상 만드는 법</b> — 음성만 모드 + 사진 + 자막.</li>
<li><b>네이버 블로그 30초 복붙 가이드</b> — 복사 버튼, 붙여넣기, 저품질 피하는 3가지.</li>
<li><b>유튜브 '비진정성 콘텐츠' 정책과 사장님 영상</b> — 왜 AI 아바타를 쓰지 않는가.</li>
<li><b>도배·장판 사장님 홈페이지에 꼭 있어야 할 5가지</b> — 업종 가이드 1.</li>
<li><b>카페 사장님, 메뉴판보다 먼저 올릴 것</b> — 업종 가이드 2.</li>
<li><b>이번 주 손님 이야기가 다음 주 손님을 부른다</b> — 최근손님이야기 카테고리 사용법.</li>
<li><b>홈페이지 제작업체 vs 온스토리, 정직한 비교</b> — 비교 페이지 확장판.</li>
<li><b>14일 무료로 무엇까지 할 수 있나</b> — 온보딩부터 첫 영상까지 체크리스트.</li>
<li><b>온스토리를 만든 이유</b> — 사업이야기 확장판.</li></ol>
<h3>리드 매그닛</h3><p>"사장님 질문 20개" — 이메일 또는 휴대폰 번호 입력 → 문자/메일로 발송. 수집 폼은 준비 중이면 /new 로 연결.</p>
`},

/* ───────────────────────── 13 비교 ───────────────────────── */
{ id: "compare", group: "메뉴 페이지", title: "홈페이지 제작업체 vs 온스토리 (/compare 비교표)",
  lead: "레멘토 vs Storyworth 11행 비교표를 그대로 옮긴다. 마감 문장: '제작업체는 홈페이지를 줍니다. 온스토리는 손님을 부릅니다.'",
  html: `
<div class="tblwrap"><table><tr><th>항목</th><th>일반 홈페이지 제작업체</th><th>온스토리</th></tr>
<tr><td>만드는 데 걸리는 시간</td><td>2~6주, 미팅 3~5회</td><td>3분 (상호명·업종·색만)</td></tr>
<tr><td>비용</td><td>제작 50~300만원 + 유지비</td><td>14일 무료 → 49,000원</td></tr>
<tr><td>만든 뒤</td><td>끝. 수정은 건당 비용</td><td>매주 질문 → 새 이야기가 쌓임</td></tr>
<tr><td>사장님이 할 일</td><td>원고·사진 준비, 검수, 수정 요청</td><td>문자 링크 누르고 60초 말하기</td></tr>
<tr><td>글쓰기</td><td>사장님 또는 외주 작가</td><td>없음 — 말하면 글이 됨</td></tr>
<tr><td>영상</td><td>별도 견적(편당 30만원~)</td><td>매주 자막 영상 포함</td></tr>
<tr><td>SNS 발행</td><td>없음</td><td>쇼츠·릴스·쓰레드·X·네이버(복붙)·홈페이지 6곳</td></tr>
<tr><td>검색 노출</td><td>등록은 해 주지만 새 페이지가 안 생김</td><td>이야기마다 새 페이지 — 검색 면적이 늘어남</td></tr>
<tr><td>사진</td><td>스톡 사진</td><td>사장님 사진 우선 + 업종별 이미지뱅크</td></tr>
<tr><td>소유권</td><td>업체 서버·업체 계정인 경우 많음</td><td>홈페이지·영상·기록 전부 사장님 것</td></tr>
<tr><td>해지</td><td>위약금·자료 반출 어려움</td><td>언제든, 자료 전부 반출</td></tr></table></div>
<div class="card dark"><b>제작업체는 홈페이지를 줍니다. 온스토리는 손님을 부릅니다.</b></div>
<p class="note">아임웹·카페24·홈온과의 개별 비교는 후순위(각 사 화면·문구 복제 금지 규칙 유지). 기능 개념만 비교한다.</p>
`},

/* ───────────────────────── 14 메뉴 기획안 ───────────────────────── */
{ id: "menu", group: "메뉴 페이지", title: "온스토리 메뉴 기획안 (상단 5 · 푸터 · 로그인 · 마이페이지)",
  lead: "상단 메뉴 '작동방식 사업이야기 자주묻는질문 리뷰 블로그' + 로그인 + [무료로 시작]. 푸터 3열. 모든 페이지가 같은 헤더·푸터(components/site/chrome.tsx)를 쓴다.",
  html: `
<h3>상단</h3>
<table><tr><th>위치</th><th>항목</th><th>동작</th></tr>
<tr><td>좌</td><td>ONSTORI 로고</td><td>/</td></tr>
<tr><td>중</td><td>작동방식 · 사업이야기 · 자주묻는질문 · 리뷰 · 블로그</td><td>/how-it-works · /our-story · /faq · /reviews · /blog</td></tr>
<tr><td>우</td><td>로그인(비로그인) / 마이페이지(로그인)</td><td>/login?next=/my · /my</td></tr>
<tr><td>우</td><td>[무료로 시작] 라임 알약</td><td>/new</td></tr>
<tr><td>모바일</td><td>☰ 메뉴 → 전체 화면 리스트, 하단 고정 [무료로 시작]</td><td>—</td></tr></table>
<h3>푸터 3열</h3>
<table><tr><th>둘러보기</th><th>회사</th><th>비교</th></tr>
<tr><td>작동방식 · 완성 예시 · 가격 · 자주묻는질문 · 리뷰 · 블로그</td><td>사업이야기 · 문의(카카오톡 채널 준비 중) · 이용약관 · 개인정보처리방침 · 운영자</td><td>홈페이지 제작업체 vs 온스토리 · (후순위) 아임웹 · 카페24</td></tr></table>
<p>맨 아래: 채널 6개 아이콘(유튜브·인스타·쓰레드·X·네이버·온스토리) · © 온스토리 · 사업자 정보(등록 후).</p>
<h3>마이페이지 (/my)</h3>
<p>내 홈페이지 목록 + <b>무료 남은 기간 D-14 배지</b> + [정회원 이용하기] + 이야기 녹화 링크 다시 받기.</p>
<h3>고객 관리자 (에디터 /[slug]/edit)</h3>
<p>홈온과 비슷한 형태이되 14일 전 기능 사용. 상단에 무료 남은 기간 바 + [정회원 이용하기]. 14일 뒤엔 차단 화면 + 토스 49,000원 모달.</p>
`},

/* ───────────────────────── 15 온보딩 ───────────────────────── */
{ id: "onboarding", group: "온보딩·정회원", title: "온보딩 5단계 기획안 (/new)",
  lead: "한 페이지 폼 → 홈온처럼 단계형. 단, 화면·문구·디자인은 독자 제작(규칙 8). 각 단계의 입력값이 기존 생성 파이프라인으로 그대로 흘러간다.",
  html: `
<table><tr><th>단계</th><th>화면</th><th>입력</th><th>기술</th></tr>
<tr><td>1</td><td><b>상호명</b> — "사장님 가게 이름부터 알려주세요" + [네이버 플레이스에서 불러오기]</td><td>businessName</td><td><code>/api/place-search</code>: 네이버 지역검색 API + 카카오 로컬 API → 후보 카드 "이 매장이 맞나요?" → 이름·업종·주소·전화 프리필. 영업시간·사진·소개는 API에 없음 → 사장님 입력. 크롤링은 하지 않는다(법적 위험 중~고). 키가 없으면 버튼은 "준비 중"으로 숨김.</td></tr>
<tr><td>2</td><td><b>업종</b> — 8대분류 → 세부 업종 칩(아주 세분화, 쇼핑몰 없음)</td><td>industryId(기존 14) + industryLabel(세부)</td><td><code>config/industry-picker.ts</code>: 세부 업종 → 기존 industries.ts id 매핑. 카피 프롬프트에 세부 업종명을 넘겨 문구가 세밀해진다.</td></tr>
<tr><td>3</td><td><b>하는 일 한 줄 + 로고 + 주소 + 전화</b> — 로고: 직접 업로드(정사각 512×512 이상, PNG/JPG/SVG, 2MB) 또는 [자동 로고 4안]</td><td>oneLiner · logo · slug · phone · address</td><td>자동 로고 4안 = 상호명 워드마크 SVG 4스타일(세리프·산세리프·모노그램·배지). 즉시·무료. AI 그림 로고는 Vertex 키 있을 때 후순위. 로고는 <code>/api/site/logo</code>로 저장소에 올리고 <code>settings.logo</code>에 URL.</td></tr>
<tr><td>4</td><td><b>분위기</b> — 다크/화이트 토글 + 8색 팔레트, 각각 미니 미리보기</td><td>dark(boolean) · accent(hex)</td><td>스키마 변경 없음: <code>theme.palette</code>=다크면 premium/화이트면 clean, <code>theme.accent</code>=선택색. 8색: 포레스트·틸·코발트·테라코타·머스터드·플럼·로즈·차콜.</td></tr>
<tr><td>5</td><td><b>"홈페이지를 만들고 있어요" 1%→100%</b> → 완성 → [정회원 이용하기] + "14일 이내에 결제하시면 이 홈페이지를 계속 유지하실 수 있습니다. 14일 이후에는 자동으로 삭제됩니다."</td><td>—</td><td>진행률은 실제 응답 시간에 맞춘 가짜 진행(30초 곡선) + 완료 시 100%. 비로그인이면 [정회원 이용하기]가 <code>/login?next=/{slug}/edit</code> — <b>회원가입(카톡/이메일) 필수</b>, 로그인 시 익명 사이트 자동 귀속(기존 claim).</td></tr></table>
<h3>세부 업종 (8대분류, 쇼핑몰 제외)</h3>
<p>시공·출장(인테리어·리모델링·도배·장판·타일·욕실·방수·전기·조명·설비·배관·보일러·누수·목공·가구제작·싱크대·샷시·창호·블라인드·커튼·에어컨설치·입주청소·준공청소·특수청소·에어컨청소·포장이사·용달·수리·AS·렌탈·철거·외벽·지붕·조경) · 카페·식당(카페·베이커리·디저트·브런치·한식·중식·일식·양식·고기·곱창·국밥·분식·치킨·피자·술집·포차) · 뷰티·케어(미용실·네일·속눈썹·피부관리·왁싱·메이크업·타투·마사지·스파) · 교육·레슨(공부방·학원·과외·피아노·미술·보컬·댄스·요가·필라테스·헬스PT·골프·수영·태권도·코딩) · 전문가·상담(세무·법무·행정·부동산·보험·심리상담·컨설팅·설계) · 건강·의료(치과·한의원·물리치료·동물병원·약국) · 공간·대관(스튜디오·파티룸·연습실·회의실·독서실·펜션·게스트하우스) · 제작·서비스(공방·인쇄·간판·사진관·영상제작·꽃집·세탁·반려동물미용·자동차정비·세차).</p>
`},

/* ───────────────────────── 16 정회원 ───────────────────────── */
{ id: "membership", group: "온보딩·정회원", title: "14일 무료 · 정회원 · 결제 · 회원 목록",
  lead: "트라이얼 14일 → 차단 → 토스페이먼츠 49,000원. 운영자 회원 목록은 결제·만료·연락을 한 화면에서.",
  html: `
<h3>규칙</h3>
<ul><li>생성 시 <code>trial_ends_at = now + 14일</code>. 마이페이지·에디터에 D-n 표시.</li>
<li>D-3, D-1 문자 안내(솔라피). D-0 지나면 크론(<code>/api/cron/expire</code>, 매일 03:00 KST)이 <code>status='expired'</code> — RLS가 공개를 끊는다. 30일 더 보관 후 삭제(사람이 어드민에서).</li>
<li>에디터: 만료 시 차단 화면 + [정회원 이용하기] 모달. 결제 성공 → <code>status='active'</code>, <code>paid_at</code>, <code>plan='light'</code>.</li>
<li>결제: 토스페이먼츠 결제위젯(1회 49,000원). 서버가 금액 재계산(규칙 4). 키(<code>TOSS_CLIENT_KEY</code>·<code>TOSS_SECRET_KEY</code>)가 없으면 모달은 "결제 준비 중 — 카카오톡 채널로 문의"를 보여준다.</li>
<li>월 9,900원 유지비(기존 가격 정책)는 <b>회장님 결정 대기</b>: 이번 기획엔 "정회원 49,000원"만 확정. 화면엔 49,000원만 표시하고 월 요금은 언급하지 않았다.</li></ul>
<h3>운영자 회원 목록 (/admin/members)</h3>
<table><tr><th>열</th><th>출처</th></tr>
<tr><td>상호명 · 홈페이지 주소</td><td>sites.business_name · slug</td></tr>
<tr><td>최초 개설일</td><td>sites.created_at</td></tr>
<tr><td>결제일</td><td>sites.paid_at (신규 컬럼)</td></tr>
<tr><td>무료 남은 기간 D-14</td><td>trial_ends_at − 오늘</td></tr>
<tr><td>연락처</td><td>settings.phone</td></tr>
<tr><td>주소</td><td>settings.address</td></tr>
<tr><td>홈페이지 완성도</td><td>site_progress.score</td></tr>
<tr><td>이메일 · 로그인 방식</td><td>auth.users (owner_id) — service role</td></tr>
<tr><td>상태</td><td>trial / active / expired</td></tr></table>
<h3>마이그레이션 (한 파일)</h3>
<pre>-- 20260905090000_mainplan_membership.sql
insert into reserved_slugs values ('mainplan'),('how-it-works'),('our-story'),('compare'),('rec'),('record'),('members'),('cron') on conflict do nothing;
alter table sites add column if not exists paid_at timestamptz, add column if not exists payment jsonb;
alter table story_entries add column if not exists question text, add column if not exists video_key text,
  add column if not exists video_out_key text, add column if not exists transcript text,
  add column if not exists media_status text not null default 'none';</pre>
`},

/* ───────────────────────── 17 녹화 ───────────────────────── */
{ id: "rec", group: "이야기 엔진", title: "60초 녹화 페이지 (/rec) · 문자 링크 · 업로드",
  lead: "레멘토 web.remento.co 14화면을 60초 규격으로 압축한 9화면. 이번 세션에서 1차 구현.",
  html: `
<table><tr><th>화면</th><th>온스토리</th><th>레멘토 대응</th></tr>
<tr><td>1</td><td>인사 — "안녕하세요, {상호명} 사장님" + [시작]</td><td>Greeting → Continue</td></tr>
<tr><td>2</td><td>오늘의 질문 4장 + [랜덤 질문 바꾸기] + 직접 입력</td><td>Your prompt → Change prompt</td></tr>
<tr><td>3</td><td>영상 / 음성만</td><td>Choose mode Audio/Video</td></tr>
<tr><td>4</td><td>카메라·마이크 허용 안내 (카톡 인앱이면 "크롬으로 열기")</td><td>Permission overlay</td></tr>
<tr><td>5</td><td>카메라 확인 · 준비됐어요</td><td>Camera & sound test → Ready</td></tr>
<tr><td>6</td><td>3·2·1 (건너뛰기)</td><td>Countdown</td></tr>
<tr><td>7</td><td>REC 0:00 / 1:00 · 일시정지 · 정지 (60초 자동 정지)</td><td>REC 0:00/30:00</td></tr>
<tr><td>8</td><td>확인 · [다시 찍기] · [보내기]</td><td>Review & submit</td></tr>
<tr><td>9</td><td>"보냈어요. 자막 영상은 30분쯤 뒤 문자로 보내드릴게요."</td><td>Done</td></tr></table>
<h3>링크 · 인증</h3>
<p><code>/rec/{slug}?k={HMAC-SHA256(slug|주차, STORY_LINK_SECRET)}</code>. 주차 단위라 링크는 그 주에만 유효. DB 조회 없이 검증. 사장님이 에디터에서 [녹화 링크 문자로 받기]를 누르면 <code>/api/story/send-link</code>가 솔라피로 보낸다(에디터 로그인 필요 → 번호는 settings.phone).</p>
<h3>업로드</h3>
<p>브라우저가 <code>/api/story/upload-url</code>에서 R2 presigned PUT(10분)을 받아 직접 올린다(Vercel 본문 4.5MB 한도 우회). 완료 후 <code>/api/story/submit</code> → <code>story_entries</code>(entry_type 'work', question, video_key, media_status 'uploaded'). R2 env가 없으면 Supabase Storage 폴백(20MB 한도).</p>
<h3>이후 (STEP 4~)</h3><p>media_status 'uploaded' 행을 워커가 집어 처리 → 'ready' → 문자로 링크 발송. 실패 시 'failed' + 어드민 알림.</p>
`}

  ]
};
