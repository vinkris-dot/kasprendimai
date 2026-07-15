import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// AI asistentas: laisva lietuviška komanda → struktūruoti veiksmai projektams.
// Veiksmai TIK pasiūlomi — taiko klientas po Kristinos patvirtinimo.

export const maxDuration = 60;

interface ProjectSnapshot {
  id: string;
  label: string;        // adresas — pagrindinis identifikatorius
  number?: string;
  client?: string;
  activeStages: string[];
  paused: boolean;
  missingDocs: number;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'finish_project',
    description: 'Pažymėti projektą baigtu: visi aktyvūs etapai užbaigiami šiandien. Naudoti, kai sakoma „baigta", „užbaigtas".',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { project_id: { type: 'string', description: 'Projekto id iš sąrašo' } },
      required: ['project_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_stage',
    description: 'Pakeisti projekto etapo būseną: activate — etapas prasideda (pvz. „priduota SLD", „įkelta derinimui" → SLD activate); complete — etapas baigtas. Etapai: SR, PP, PP_VIESIMAS (viešinimas), IP, SLD, PAKARTOTINIS, TDP, EKSPERTIZE.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        stage: { type: 'string', enum: ['SR', 'PP', 'PP_VIESIMAS', 'IP', 'SLD', 'PAKARTOTINIS', 'TDP', 'EKSPERTIZE'] },
        action: { type: 'string', enum: ['activate', 'complete'] },
      },
      required: ['project_id', 'stage', 'action'],
      additionalProperties: false,
    },
  },
  {
    name: 'pause_project',
    description: 'Pristabdyti projektą (kai „atidėta", „stovi", „užsakovas dingo", „laukiam"). reason — trumpa priežastis lietuviškai.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        reason: { type: 'string', description: 'Pristabdymo priežastis' },
      },
      required: ['project_id', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'resume_project',
    description: 'Atnaujinti pristabdytą projektą (kai „atsinaujino", „vėl dirbam", „grįžo").',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_task',
    description: 'Pridėti užduotį („reikia paskambinti", „užsakyti", „padaryti"). assignee: NR=Nerijus (koordinacija, dokumentai, derinimai), KV=Kristina (architektūra, PP), LL=Lina (techninis braižymas).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        label: { type: 'string', description: 'Užduoties tekstas lietuviškai' },
        assignee: { type: 'string', enum: ['NR', 'KV', 'LL', 'EXT'] },
        due_date: { type: 'string', description: 'YYYY-MM-DD arba tuščia, jei termino nėra' },
      },
      required: ['project_id', 'label', 'assignee', 'due_date'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_note',
    description: 'Įrašyti pastabą projekte (gautos savivaldybės pastabos, susitarimai, svarbūs faktai, kurie netelpa į kitus veiksmus).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        text: { type: 'string', description: 'Pastabos tekstas lietuviškai' },
      },
      required: ['project_id', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_document',
    description: 'Pažymėti dokumento būseną: uzsakyta (užsakytas, laukiama) arba gauta. Dokumentų numeriai: 00 įgaliojimas, 01 projektavimo užduotis, 02 nuosavybė, 03 sklypo ribų planas, 04 teritorijų planavimas, 05 specialieji reikalavimai (SR), 06 prisijungimo sąlygos, 07 toponuotrauka.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        doc_number: { type: 'string', enum: ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'] },
        status: { type: 'string', enum: ['uzsakyta', 'gauta'] },
      },
      required: ['project_id', 'doc_number', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'archive_project',
    description: 'Archyvuoti projektą (kai „nebėra objekto", „nepasirašė sutarties", „atšauktas"). Naudoti atsargiai.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
      additionalProperties: false,
    },
  },
];

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Trūksta ANTHROPIC_API_KEY. Pridėkite raktą .env.local faile (lokaliai) ir Vercel projekto Environment Variables (gyvai).' },
      { status: 503 },
    );
  }

  const { command, projects } = (await req.json()) as { command: string; projects: ProjectSnapshot[] };
  if (!command?.trim() || !Array.isArray(projects)) {
    return NextResponse.json({ error: 'Trūksta komandos arba projektų sąrašo.' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const projectList = projects
    .map(p => `- id:${p.id} | ${p.label}${p.number ? ` (${p.number})` : ''}${p.client ? ` | užsakovas: ${p.client}` : ''} | aktyvūs etapai: ${p.activeStages.join(', ') || '—'}${p.paused ? ' | PRISTABDYTAS' : ''}${p.missingDocs ? ` | trūksta ${p.missingDocs} dok.` : ''}`)
    .join('\n');

  const system = `Tu — architektūros biuro „KA sprendimai" projektų valdymo asistentas.
Kristina diktuoja projektų statusų pakeitimus laisva lietuvių kalba. Tavo darbas —
paversti jos žodžius struktūruotais veiksmais (tool calls). Veiksmai bus parodyti
Kristinai patvirtinti prieš taikant, todėl siūlyk drąsiai, bet tiksliai.

Taisyklės:
- Projektai identifikuojami pagal ADRESĄ. Kristina mini sutrumpintai („Akmens",
  „Tujų 4") — surask atitinkamą projektą sąraše pagal adreso fragmentą.
- Jei paminėtas adresas tinka KELIEMS projektams ir neaišku kuriam, NEspėliok —
  atsakyk tekstu, paklausdama kurio.
- Vienoje žinutėje gali būti daug projektų — sukurk veiksmą kiekvienam paminėtam.
- Domenas: SR = paruošiamasis etapas (dokumentai, sąlygos); PP = projektiniai
  pasiūlymai; viešinimas = PP_VIESIMAS; IP = išankstiniai pritarimai; SLD =
  statybą leidžiantis dokumentas („priduota", „įkelta", „derinasi" → SLD arba
  PAKARTOTINIS activate); TDP = techninis darbo projektas (inžinerinės dalys).
- „Baigta" apie visą projektą → finish_project; apie konkretų etapą → set_stage complete.
- „Gauta pastabų" → add_note. Datas interpretuok: šiandien = ${today}.
- Jei komanda neaiški ar joje nėra jokio veiksmo, atsakyk trumpai tekstu lietuviškai.

Projektų sąrašas:
${projectList}`;

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      output_config: { effort: 'low' },
      system,
      tools: TOOLS,
      messages: [{ role: 'user', content: command }],
    });

    const actions = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => ({ tool: b.name, input: b.input as Record<string, string> }));
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return NextResponse.json({ actions, text });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'Neteisingas ANTHROPIC_API_KEY raktas.' }, { status: 503 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Per daug užklausų — pabandykite po minutės.' }, { status: 429 });
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return NextResponse.json({ error: 'Nepavyko pasiekti Anthropic API — patikrinkite ryšį.' }, { status: 502 });
    }
    const msg = e instanceof Anthropic.APIError ? `API klaida: ${e.message}` : 'Nenumatyta klaida.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
