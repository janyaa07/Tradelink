import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ART_KINDS } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { signOut } from "@/features/auth/actions";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Button } from "@/ui/Button";
import { Chip, ChipRow } from "@/ui/Chip";
import { EmptyState } from "@/ui/EmptyState";
import { FieldGrid, SelectField, TextAreaField, TextField } from "@/ui/Field";
import { formatDate, formatDateTime, greeting, issueNumber, orderNumber } from "@/ui/format";
import { FormError } from "@/ui/FormError";
import { Icon, ICON_NAMES } from "@/ui/Icon";
import { LinkButton } from "@/ui/LinkButton";
import { Panel } from "@/ui/Panel";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { ProgressSteps, type OrderStatus } from "@/ui/ProgressSteps";
import { RecordCard, RecordList } from "@/ui/RecordCard";
import { Segmented } from "@/ui/Segmented";
import { HomeGreeting } from "@/features/home/HomeParts";
import { AppShell } from "@/ui/shell/AppShell";
import type { NavItem } from "@/ui/shell/types";
import { Switch } from "@/ui/Switch";
import { ThemeSetting } from "@/ui/ThemeSetting";
import { ThemeToggle } from "@/ui/ThemeToggle";
import { Tiles } from "@/ui/Tiles";
import { TodoItem, TodoList } from "@/ui/TodoItem";

export const metadata: Metadata = {
  title: "Component kit · Tradelink",
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/kit", label: "Home", icon: "home" },
  { href: "/kit#attention", label: "Attention", icon: "flag", count: 3 },
  { href: "/kit#orders", label: "Orders", icon: "list" },
  { href: "/kit#suppliers", label: "Suppliers", icon: "crate" },
  { href: "/kit#notifications", label: "Notifications", icon: "bell", count: 2 },
  { href: "/kit#users", label: "Users", icon: "users" },
  { href: "/kit#operators", label: "Operators", icon: "headset" },
  { href: "/kit#status", label: "System status", icon: "pulse" },
  { href: "/kit#audit", label: "Audit log", icon: "shield" },
  { href: "/kit#settings", label: "Settings", icon: "gear" },
];

const BUSINESSES = [
  "Mei's Noodle House",
  "Seaside Kopitiam",
  "Harbour Dry Goods",
  "Fresh Lane Produce",
  "Bright Pantry Supplies",
  "Tradelink Operations",
  "Lucky Chicken Rice",
  "Golden Spoon Catering",
];

const STATUSES: { status: OrderStatus; label: string; tone: "warn" | "info" | "good" | "bad" | "plain" }[] = [
  { status: "pending", label: "Pending", tone: "warn" },
  { status: "accepted", label: "Accepted", tone: "info" },
  { status: "out_for_delivery", label: "Out for delivery", tone: "info" },
  { status: "delivered", label: "Delivered", tone: "good" },
  { status: "rejected", label: "Rejected", tone: "bad" },
  { status: "cancelled", label: "Cancelled", tone: "plain" },
];

const MORNING = new Date("2026-11-03T02:00:00Z");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export default function KitPage() {
  return (
    <AppShell
      role="admin"
      userName="Priya Raman"
      orgName="Tradelink Operations"
      navItems={NAV}
      activeHref="/kit"
      pathname="/kit"
      bell={{ href: "/kit#todo", count: 4 }}
      cart={{ count: 3, href: "/kit#orders" }}
      signOutAction={signOut}
    >
      <div className="flex flex-col gap-[3px]">
        <h1>Component kit</h1>
        <p className="text-muted">Every shared component in its main states, for review and accessibility checks.</p>
      </div>

      <Section title="Buttons">
        <Row>
          <Button>Part accept</Button>
          <Button variant="primary">Accept order</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="primary" disabled>
            Review and send
          </Button>
        </Row>
        <p className="text-[.84rem] text-muted">Review and send is off until every line has a product.</p>
        <Button variant="primary" size="big">
          Confirm and reserve stock
        </Button>
        <Row>
          <LinkButton href="/kit#orders">Report a problem</LinkButton>
          <LinkButton href="/kit#orders" variant="primary">
            Review and send
          </LinkButton>
          <LinkButton href="/kit#orders" variant="text">
            See all
          </LinkButton>
          <LinkButton href="/kit?toast=Price%20updated." variant="text">
            Show a toast
          </LinkButton>
        </Row>
      </Section>

      <Section title="Pills, chips and segmented">
        <Row>
          <Pill tone="good">Delivered</Pill>
          <Pill tone="warn">Pending</Pill>
          <Pill tone="bad">Out of stock</Pill>
          <Pill tone="info">Stock to confirm</Pill>
          <Pill tone="plain">Cancelled</Pill>
        </Row>
        <ChipRow label="Categories">
          <Chip href="/kit" selected>
            All
          </Chip>
          <Chip href="/kit?category=fresh">Fresh</Chip>
          <Chip href="/kit?category=dry_goods">Dry goods</Chip>
          <Chip selected={false}>Oils and sauces</Chip>
          <Chip selected>Supplies</Chip>
        </ChipRow>
        <Segmented
          label="Order views"
          items={[
            { href: "/kit", label: "Orders", current: true },
            { href: "/kit?tab=invoices", label: "Invoices", current: false },
          ]}
        />
      </Section>

      <Section title="Home greeting and figures">
        <HomeGreeting
          eyebrow="Wednesday 4 November · Mei's Noodle House"
          title={`${greeting(MORNING)}, Mei`}
          line="Two things need you this morning, starting with tomorrow's order."
        />
        <Tiles
          items={[
            { label: "Orders today", value: 18 },
            { label: "Open problems", value: 4, alert: true },
            { label: "Active suppliers", value: 12 },
            { label: "Buyers", value: 46 },
          ]}
        />
      </Section>

      <Section title="Panels and to-do items">
        <div className="grid items-start gap-3.5 min-[860px]:grid-cols-2">
          <Panel title="To do">
            <TodoList>
              <TodoItem
                tone="warn"
                title="Jasmine rice 5kg went up 4.2%"
                detail="S$11.90 to S$12.40 at Harbour Dry Goods."
                actions={<Button>OK, noted</Button>}
              />
              <TodoItem
                tone="bad"
                title="Do not pay INV-305 yet"
                detail="It shows a new bank account ending 4471. Phone the supplier before paying."
                actions={<Button>I confirmed by phone</Button>}
              />
              <TodoItem tone="good" title={`Reply on ${orderNumber(1042)}`} detail="Fresh Lane Produce will credit S$8.40." />
            </TodoList>
          </Panel>
          <Panel
            title="Recent activity"
            action={
              <LinkButton href="/kit#audit" variant="text">
                See all
              </LinkButton>
            }
          >
            <p className="text-muted">No activity yet.</p>
          </Panel>
        </div>
        <EmptyState action={<LinkButton href="/kit#orders">New order</LinkButton>}>No orders yet.</EmptyState>
      </Section>

      <Section title="Record cards and progress">
        <RecordList>
          <RecordCard
            lead={<BusinessLogo name="Harbour Dry Goods" />}
            title="Harbour Dry Goods"
            sub={<span className="font-mono text-[.86em]">{orderNumber(1042)}</span>}
            pill={<Pill tone="info">Out for delivery</Pill>}
            footer={
              <>
                {formatDateTime("2026-11-03T06:05:00Z")} · <b className="tabular-nums text-ink">{formatMoney("184.50")}</b>
              </>
            }
            actions={
              <>
                <Button variant="primary">All here</Button>
                <Button>Report a problem</Button>
              </>
            }
          >
            <ProgressSteps status="out_for_delivery" />
          </RecordCard>
          <RecordCard
            lead={<ProductArt kind="sack" size={36} />}
            title="Jasmine rice 5kg"
            sub="per bag · Harbour Dry Goods"
            pill={<Pill tone="warn">Low</Pill>}
            metrics={[
              { label: "On hand", value: 14 },
              { label: "Reserved", value: 6 },
              { label: "Available", value: 8 },
              { label: "Reorder at", value: 10 },
            ]}
            note={`Next delivery ${formatDate("2026-11-04")}. Issue ${issueNumber(302)} is open.`}
            actions={<Button>Receive stock</Button>}
          />
        </RecordList>
        <div className="flex flex-col gap-3">
          {STATUSES.map(({ status, label, tone }) => (
            <div key={status} className="flex flex-col gap-1.5">
              <Pill tone={tone}>{label}</Pill>
              <ProgressSteps status={status} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Product art, logos and icons">
        <Row>
          {ART_KINDS.map((kind) => (
            <ProductArt key={kind} kind={kind} />
          ))}
        </Row>
        <div className="w-[148px]">
          <ProductArt kind="egg" size="fill" />
        </div>
        <ul className="flex flex-wrap gap-3">
          {BUSINESSES.map((name) => (
            <li key={name} className="flex items-center gap-2 text-[.84rem]">
              <BusinessLogo name={name} />
              {name}
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-3 text-accent">
          {ICON_NAMES.map((name) => (
            <li key={name} className="flex flex-col items-center gap-1 text-[.72rem] text-muted">
              <Icon name={name} size={24} className="text-accent" />
              {name}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Forms">
        <Panel title="Add a product">
          <FieldGrid>
            <TextField label="Product name" name="name" placeholder="Red lentils 1kg" />
            <SelectField label="Sold by" name="unit" defaultValue="pack">
              <option value="bag">bag</option>
              <option value="pack">pack</option>
              <option value="tin">tin</option>
            </SelectField>
            <TextField label="Price (S$)" name="price" type="number" min="0" step="0.01" error="Enter a price above 0." />
            <TextField label="Opening stock" name="stock" type="number" min="0" step="1" hint="Whole units only." />
          </FieldGrid>
          <TextAreaField label="Order message" name="message" mono defaultValue={"10 bags jasmine rice\n4 tins condensed milk"} />
          <FormError>Enter a price above 0.</FormError>
          <Row>
            <Button variant="primary">Add product</Button>
            <Button>Cancel</Button>
          </Row>
        </Panel>
      </Section>

      <Section title="Settings controls">
        <Panel title="Appearance">
          <Row>
            <ThemeSetting />
            <ThemeToggle />
          </Row>
        </Panel>
        <Panel title="Alerts and suggestions">
          <div>
            <Switch
              title="Suggest what to reorder"
              description="Uses how fast you go through each usual item."
              name="lowStock"
              defaultChecked
            />
            <Switch
              title="Tell me about price changes"
              description="Shows changes to your usual items on Today."
              name="priceAlerts"
            />
            <Switch
              title="Warn me before I go over budget"
              description="Shows a warning when you review an order."
              name="budgetWarn"
              disabled
            />
          </div>
        </Panel>
      </Section>
    </AppShell>
  );
}
