import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Blocks,
  Activity,
  Rocket,
  Shield,
  Globe,
  Sparkles,
  Zap,
  Code2,
  Database,
  ArrowRight,
  Github,
  ChevronDown,
} from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function LandingPage() {
  const { t } = useTranslation()

  const features = [
    { icon: Blocks, title: t('landing.features.builder.title'), desc: t('landing.features.builder.desc'), color: 'text-accent' },
    { icon: Activity, title: t('landing.features.metrics.title'), desc: t('landing.features.metrics.desc'), color: 'text-ember' },
    { icon: Rocket, title: t('landing.features.deploy.title'), desc: t('landing.features.deploy.desc'), color: 'text-success' },
    { icon: Shield, title: t('landing.features.security.title'), desc: t('landing.features.security.desc'), color: 'text-info' },
    { icon: Database, title: t('landing.features.codegen.title'), desc: t('landing.features.codegen.desc'), color: 'text-accent' },
    { icon: Globe, title: t('landing.features.i18n.title'), desc: t('landing.features.i18n.desc'), color: 'text-ember' },
  ]

  const steps = [
    { num: '01', title: t('landing.steps.design.title'), desc: t('landing.steps.design.desc') },
    { num: '02', title: t('landing.steps.generate.title'), desc: t('landing.steps.generate.desc') },
    { num: '03', title: t('landing.steps.deploy.title'), desc: t('landing.steps.deploy.desc') },
  ]

  return (
    <div className="min-h-screen bg-bg-root text-text-primary">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 border-b border-edge/50 bg-bg-root/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent/15 border border-accent/25">
              <Zap className="size-5 text-accent" />
            </div>
            <span className="text-lg font-display font-bold tracking-tight">BackForge</span>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="pill" />
            <Link
              to="/app"
              className="rounded-lg border border-edge bg-bg-raised px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:border-edge-strong transition-colors"
            >
              {t('landing.nav.openApp')}
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-root hover:bg-accent/90 transition-colors"
            >
              {t('landing.nav.getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-accent/8 blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] rounded-full bg-ember/5 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs font-medium text-accent mb-8">
            <Sparkles className="size-3.5" />
            {t('landing.hero.badge')}
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1]">
            {t('landing.hero.title1')}
            <br />
            <span className="text-gradient-accent">{t('landing.hero.title2')}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/app"
              className="group flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-bg-root hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
            >
              {t('landing.hero.tryFree')}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://github.com/lupodelvita/BackForge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-edge bg-bg-raised px-6 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:border-edge-strong transition-colors"
            >
              <Github className="size-4" />
              GitHub
            </a>
          </div>

          {/* Scroll hint */}
          <div className="mt-16 flex justify-center">
            <ChevronDown className="size-5 text-text-muted animate-bounce" />
          </div>
        </div>
      </section>

      {/* ─── App Preview ─── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative rounded-2xl border border-edge bg-bg-surface/50 shadow-2xl shadow-black/20 overflow-hidden">
          {/* Faux title bar */}
          <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
            <div className="flex gap-1.5">
              <div className="size-3 rounded-full bg-red-500/60" />
              <div className="size-3 rounded-full bg-yellow-500/60" />
              <div className="size-3 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 text-center text-xs text-text-muted font-mono">backforge.app</div>
          </div>

          {/* Screenshot placeholder — shows a stylized version of the dashboard */}
          <div className="p-6 grid grid-cols-4 gap-4">
            {/* Sidebar mock */}
            <div className="col-span-1 space-y-3">
              <div className="h-8 rounded-lg bg-accent/12 flex items-center gap-2 px-3">
                <div className="size-4 rounded bg-accent/30" />
                <div className="h-2.5 w-16 rounded bg-accent/30" />
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-7 rounded-lg bg-bg-raised flex items-center gap-2 px-3">
                  <div className="size-3 rounded bg-edge" />
                  <div className="h-2 rounded bg-edge" style={{ width: `${50 + (i * 10) % 40}px` }} />
                </div>
              ))}
            </div>

            {/* Main content mock */}
            <div className="col-span-3 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {['accent', 'ember', 'success'].map((c) => (
                  <div key={c} className="rounded-xl border border-edge bg-bg-raised p-4">
                    <div className="h-2 w-12 rounded bg-text-muted/30 mb-2" />
                    <div className={`h-6 w-16 rounded bg-${c}/20`} />
                    <div className="h-1.5 w-20 rounded bg-edge mt-2" />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-edge bg-bg-raised p-4 space-y-2">
                <div className="h-2.5 w-28 rounded bg-text-muted/30" />
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="h-5 w-14 rounded bg-accent/15" />
                    <div className="h-2 flex-1 rounded bg-edge" />
                    <div className="h-2 w-10 rounded bg-edge" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="border-t border-edge bg-bg-surface/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold">{t('landing.features.title')}</h2>
            <p className="mt-4 text-text-secondary max-w-xl mx-auto">{t('landing.features.subtitle')}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-edge bg-bg-root p-6 hover:border-edge-strong hover:bg-bg-raised/30 transition-all duration-300">
                <div className={`flex size-11 items-center justify-center rounded-xl bg-bg-raised ${f.color}`}>
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold">{t('landing.howItWorks.title')}</h2>
            <p className="mt-4 text-text-secondary">{t('landing.howItWorks.subtitle')}</p>
          </div>

          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.num} className="flex items-start gap-6 rounded-2xl border border-edge bg-bg-surface/50 p-6 hover:border-accent/30 transition-colors">
                <span className="text-3xl font-display font-bold text-accent/30">{step.num}</span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-text-secondary leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tech Stack Badges ─── */}
      <section className="border-t border-edge py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-sm text-text-muted uppercase tracking-widest mb-6">{t('landing.stack.title')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {['Go', 'Rust', 'React', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'Tailwind CSS'].map((tech) => (
              <span key={tech} className="rounded-full border border-edge bg-bg-raised px-4 py-1.5 text-sm text-text-secondary font-mono">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative overflow-hidden border-t border-edge py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-accent/8 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <Code2 className="mx-auto size-12 text-accent mb-6" />
          <h2 className="text-3xl sm:text-4xl font-display font-bold">{t('landing.cta.title')}</h2>
          <p className="mt-4 text-text-secondary">{t('landing.cta.subtitle')}</p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/app"
              className="group flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-bg-root hover:bg-accent/90 transition-all"
            >
              {t('landing.hero.tryFree')}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/register"
              className="rounded-xl border border-edge bg-bg-raised px-6 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:border-edge-strong transition-colors"
            >
              {t('landing.nav.getStarted')}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-edge py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Zap className="size-4 text-accent" />
            <span>BackForge &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/lupodelvita/BackForge" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary transition-colors">
              <Github className="size-4" />
            </a>
            <LanguageSwitcher variant="pill" />
          </div>
        </div>
      </footer>
    </div>
  )
}
