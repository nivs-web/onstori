-- 예약 슬러그 확장 (~200개) — 경로 방식(onstori.com/{slug}) 전환에 따른 최상위 네임스페이스 선점.
-- 추후 본사 페이지·기능으로 쓸 가능성이 있는 단어는 전부 고객이 잡을 수 없게 한다.
-- 고객이 입력 시 "사용할 수 없는 주소예요" 안내 (slug-check / generate가 이 테이블을 조회).

insert into reserved_slugs (slug) values
-- 시스템·인프라
('api'),('app'),('apps'),('www'),('web'),('cdn'),('static'),('assets'),('asset'),('public'),
('img'),('image'),('images'),('media'),('file'),('files'),('upload'),('uploads'),('download'),('downloads'),
('sitemap'),('robots'),('favicon'),('manifest'),('health'),('status'),('ping'),('metrics'),('internal'),('system'),
-- 인증·계정
('login'),('logout'),('signin'),('signout'),('signup'),('register'),('auth'),('oauth'),('sso'),('token'),
('password'),('reset'),('verify'),('confirm'),('account'),('accounts'),('profile'),('user'),('users'),('member'),
('members'),('membership'),('session'),('sessions'),
-- 운영자·관리
('admin'),('administrator'),('manage'),('manager'),('console'),('dashboard'),('operator'),('staff'),('root'),('owner'),
('my'),('mypage'),('settings'),('setting'),('config'),('preferences'),
-- 제품 핵심 기능
('new'),('create'),('edit'),('editor'),('preview'),('publish'),('draft'),('drafts'),('generate'),('generator'),
('wizard'),('builder'),('template'),('templates'),('theme'),('themes'),('design'),('designs'),('section'),('sections'),
('story'),('stories'),('feed'),('timeline'),('gallery'),('photo'),('photos'),('video'),('videos'),('movie'),('movies'),
('hero'),('banner'),('banners'),('widget'),('widgets'),('logo'),('brand'),('branding'),('brandkit'),('kit'),
('card'),('cards'),('stamp'),('qr'),('qrcode'),('domain'),('domains'),('subdomain'),('dns'),('bank'),('imagebank'),
-- 커머스·결제
('shop'),('store'),('mall'),('cart'),('checkout'),('pay'),('payment'),('payments'),('billing'),('invoice'),
('order'),('orders'),('product'),('products'),('item'),('items'),('price'),('prices'),('pricing'),('plan'),
('plans'),('subscribe'),('subscription'),('coupon'),('coupons'),('promo'),('promotion'),('event'),('events'),('gift'),
-- 소통·지원
('help'),('support'),('faq'),('contact'),('inquiry'),('inquiries'),('quote'),('quotes'),('booking'),('book'),
('reserve'),('reservation'),('chat'),('chatbot'),('bot'),('message'),('messages'),('notice'),('notices'),('news'),
('blog'),('board'),('forum'),('community'),('review'),('reviews'),('guide'),('guides'),('docs'),('doc'),
('tutorial'),('tutorials'),('mail'),('email'),('sms'),('notification'),('notifications'),('alert'),('alerts'),
-- 회사·법무
('about'),('company'),('team'),('teams'),('career'),('careers'),('jobs'),('job'),('press'),('partner'),
('partners'),('partnership'),('affiliate'),('referral'),('invite'),('terms'),('privacy'),('policy'),('legal'),('license'),
-- 도구·부가 기능 (추후 확장 대비)
('cal'),('calendar'),('map'),('maps'),('search'),('tag'),('tags'),('category'),('categories'),('portfolio'),
('showcase'),('example'),('examples'),('sample'),('demo'),('report'),('reports'),('analytics'),('stats'),('export'),
('import'),('backup'),('webhook'),('webhooks'),('callback'),('ai'),('seo'),('marketing'),('ads'),('ad'),
-- 환경·언어·브랜드
('dev'),('test'),('staging'),('beta'),('alpha'),('local'),('m'),('mobile'),('en'),('ko'),
('jp'),('cn'),('kr'),('home'),('index'),('main'),('official'),('onstori'),('on-stori'),('stori')
on conflict (slug) do nothing;
