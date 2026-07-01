CREATE TABLE "casas_aposta" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"cor" text DEFAULT '#6366f1' NOT NULL,
	"logo" text,
	"variaveis" jsonb DEFAULT '{}' NOT NULL,
	"paineis_cpa" jsonb DEFAULT '[]' NOT NULL,
	"funil_ids" jsonb DEFAULT '[]' NOT NULL,
	CONSTRAINT "casas_aposta_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "disparos" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"nomenclatura" text NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"casas_aposta" jsonb DEFAULT '[]' NOT NULL,
	"data_disparo" text NOT NULL,
	"horario_disparo" text DEFAULT '10:00' NOT NULL,
	"base" jsonb DEFAULT '{}' NOT NULL,
	"template_daxx" jsonb,
	"numero_sendpulse" jsonb,
	"esteira_pai_id" text,
	"numeros_sendpulse" jsonb,
	"link_templates_selecionados" jsonb,
	"criado_em" text NOT NULL,
	"atualizado_em" text NOT NULL,
	"notas" text,
	"flow_ids" jsonb,
	"cpa_painel_id" text,
	"utm" text,
	"betmgm_pid" text,
	"resultados" jsonb,
	"valor_total_base" real,
	"conversao" jsonb
);
--> statement-breakpoint
CREATE TABLE "esteiras" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"casas_aposta" jsonb DEFAULT '[]' NOT NULL,
	"disparos" jsonb DEFAULT '{}' NOT NULL,
	"criado_em" text NOT NULL,
	"atualizado_em" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_tag_configs" (
	"flow_id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"funil" text,
	"utm" text
);
--> statement-breakpoint
CREATE TABLE "link_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"casa_id" text NOT NULL,
	"nome" text NOT NULL,
	"url_template" text NOT NULL,
	"tipos" jsonb DEFAULT '[]' NOT NULL,
	"criado_em" text NOT NULL,
	"atualizado_em" text NOT NULL
);
