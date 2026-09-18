'use client';

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Plus, Save, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { AdminField } from '@/components/admin-form';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { parseBRLToCents } from '@/shared/finance';
import {
  TEIKO_BRAND_ID,
  formatBRL,
  type Modifier,
  type ModifierGroup,
} from '@/shared/domain';

export default function ModifiersPage() {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [form, setForm] = useState<'modifier' | 'group' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const db = getFirebaseClient().db;
    const a = onSnapshot(
      query(
        collection(db, 'modifiers'),
        where('brandId', '==', TEIKO_BRAND_ID),
        orderBy('displayOrder'),
      ),
      (snap) =>
        setModifiers(
          snap.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as Modifier,
          ),
        ),
    );
    const b = onSnapshot(
      query(
        collection(db, 'modifierGroups'),
        where('brandId', '==', TEIKO_BRAND_ID),
        orderBy('displayOrder'),
      ),
      (snap) =>
        setGroups(
          snap.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as ModifierGroup,
          ),
        ),
    );
    return () => {
      a();
      b();
    };
  }, []);
  async function saveModifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const payload = {
      brandId: TEIKO_BRAND_ID,
      name: String(data.get('name')).trim(),
      active: data.get('active') === 'on',
      available: data.get('available') === 'on',
      priceCents: parseBRLToCents(String(data.get('price') || '0')),
      premium: data.get('premium') === 'on',
      maxQuantity: data.get('maxQuantity')
        ? Number(data.get('maxQuantity'))
        : null,
      allergenKeys: String(data.get('allergenKeys'))
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      displayOrder: Number(data.get('displayOrder')),
      imageUrl: String(data.get('imageUrl')).trim(),
      updatedAt: serverTimestamp(),
    };
    try {
      if (
        !payload.name ||
        !Number.isSafeInteger(payload.priceCents) ||
        payload.priceCents < 0
      )
        throw new Error('Informe o nome e um preço válido.');
      const db = getFirebaseClient().db;
      if (editingModifier)
        await setDoc(doc(db, 'modifiers', editingModifier.id), payload, {
          merge: true,
        });
      else await addDoc(collection(db, 'modifiers'), payload);
      setForm(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao salvar.');
    }
  }
  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const payload = {
      brandId: TEIKO_BRAND_ID,
      name: String(data.get('name')).trim(),
      description: String(data.get('description')).trim(),
      active: data.get('active') === 'on',
      required: data.get('required') === 'on',
      minSelections: Number(data.get('minSelections')),
      maxSelections: Number(data.get('maxSelections')),
      freeIncludedCount: data.get('freeIncludedCount')
        ? Number(data.get('freeIncludedCount'))
        : null,
      allowDuplicate: data.get('allowDuplicate') === 'on',
      maxPerModifier: data.get('maxPerModifier')
        ? Number(data.get('maxPerModifier'))
        : null,
      appliesToSizeIds: editingGroup?.appliesToSizeIds ?? [],
      displayOrder: Number(data.get('displayOrder')),
      pricingMode: String(data.get('pricingMode')),
      modifierIds: selectedModifierIds,
      updatedAt: serverTimestamp(),
    };
    try {
      if (
        !payload.name ||
        payload.minSelections > payload.maxSelections ||
        !Number.isSafeInteger(payload.maxSelections)
      )
        throw new Error('Revise nome e limites do grupo.');
      const db = getFirebaseClient().db;
      if (editingGroup)
        await setDoc(doc(db, 'modifierGroups', editingGroup.id), payload, {
          merge: true,
        });
      else await addDoc(collection(db, 'modifierGroups'), payload);
      setForm(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao salvar.');
    }
  }
  return (
    <AdminShell adminOnly>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8b1e2b]">
            Regras
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
            Adicionais
          </h1>
          <p className="mt-2 text-sm text-[#7b887d]">
            Disponibilidade muda na hora, sem deploy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              setEditingGroup(null);
              setSelectedModifierIds([]);
              setForm('group');
            }}
          >
            <Plus /> Grupo
          </Button>
          <Button
            className="rounded-full bg-[#b5232b] text-white"
            onClick={() => {
              setEditingModifier(null);
              setForm('modifier');
            }}
          >
            <Plus /> Adicional
          </Button>
        </div>
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-black">Itens</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modifiers.map((modifier) => (
            <article
              key={modifier.id}
              className="rounded-[22px] bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{modifier.name}</h3>
                  <p className="mt-1 text-xs text-[#7b887d]">
                    {modifier.premium ? 'Premium • ' : ''}
                    {formatBRL(modifier.priceCents)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateDoc(
                      doc(getFirebaseClient().db, 'modifiers', modifier.id),
                      {
                        available: !modifier.available,
                        updatedAt: serverTimestamp(),
                      },
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${modifier.available ? 'bg-[#d6e7bf]/25 text-[#3a5b35]' : 'bg-[#e8efe5] text-[#e3262e]'}`}
                >
                  {modifier.available ? 'DISPONÍVEL' : 'INDISPONÍVEL'}
                </button>
              </div>
              <button
                onClick={() => {
                  setEditingModifier(modifier);
                  setForm('modifier');
                }}
                className="mt-4 text-xs font-black text-[#b5232b]"
              >
                Editar regras
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-9">
        <h2 className="text-xl font-black">Grupos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <article
              key={group.id}
              className="rounded-[22px] bg-white p-4 shadow-sm"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-black">{group.name}</h3>
                  <p className="mt-1 text-xs text-[#7b887d]">
                    {group.required ? 'Obrigatório' : 'Opcional'} •{' '}
                    {group.minSelections} a {group.maxSelections} •{' '}
                    {group.pricingMode === 'includedQuota'
                      ? 'usa cota'
                      : 'preço individual'}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#b5232b]">
                  {group.modifierIds.length} itens
                </span>
              </div>
              <button
                onClick={() => {
                  setEditingGroup(group);
                  setSelectedModifierIds(group.modifierIds);
                  setForm('group');
                }}
                className="mt-4 text-xs font-black text-[#b5232b]"
              >
                Editar grupo
              </button>
            </article>
          ))}
        </div>
      </section>
      {form && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#070a08]/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={form === 'modifier' ? saveModifier : saveGroup}
            className="mx-auto my-4 max-w-2xl rounded-[28px] bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">
                {form === 'modifier'
                  ? 'Configurar adicional'
                  : 'Configurar grupo'}
              </h2>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="grid size-9 place-items-center rounded-full bg-[#e8efe5]"
              >
                <X className="size-4" />
              </button>
            </div>
            {form === 'modifier' ? (
              <ModifierForm
                value={editingModifier}
                order={modifiers.length + 1}
              />
            ) : (
              <GroupForm value={editingGroup} order={groups.length + 1} modifiers={modifiers} selectedIds={selectedModifierIds} onChange={setSelectedModifierIds} />
            )}
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-[#e8efe5] p-3 text-sm text-[#e3262e]"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="mt-6 h-11 w-full rounded-full bg-[#b5232b] font-black text-white"
            >
              <Save /> Salvar
            </Button>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
function ModifierForm({
  value,
  order,
}: {
  value: Modifier | null;
  order: number;
}) {
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <AdminField
          label="Nome"
          name="name"
          required
          defaultValue={value?.name}
        />
        <AdminField
          label="Preço (R$)"
          name="price"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={((value?.priceCents ?? 0) / 100).toFixed(2)}
        />
        <AdminField
          label="Máximo por item"
          name="maxQuantity"
          type="number"
          min="1"
          defaultValue={value?.maxQuantity}
        />
        <AdminField
          label="Ordem"
          name="displayOrder"
          type="number"
          required
          defaultValue={value?.displayOrder ?? order}
        />
        <AdminField
          label="Alérgenos, separados por vírgula"
          name="allergenKeys"
          defaultValue={value?.allergenKeys.join(', ')}
        />
        <AdminField
          label="URL da imagem"
          name="imageUrl"
          defaultValue={value?.imageUrl}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
        <label>
          <input
            type="checkbox"
            name="active"
            defaultChecked={value?.active ?? true}
          />{' '}
          Ativo
        </label>
        <label>
          <input
            type="checkbox"
            name="available"
            defaultChecked={value?.available ?? true}
          />{' '}
          Disponível
        </label>
        <label>
          <input
            type="checkbox"
            name="premium"
            defaultChecked={value?.premium}
          />{' '}
          Premium
        </label>
      </div>
    </>
  );
}
function GroupForm({
  value,
  order,
  modifiers,
  selectedIds,
  onChange,
}: {
  value: ModifierGroup | null;
  order: number;
  modifiers: Modifier[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <AdminField
          label="Nome"
          name="name"
          required
          defaultValue={value?.name}
        />
        <AdminField
          label="Descrição"
          name="description"
          defaultValue={value?.description}
        />
        <AdminField
          label="Mínimo"
          name="minSelections"
          type="number"
          min="0"
          required
          defaultValue={value?.minSelections ?? 0}
        />
        <AdminField
          label="Máximo"
          name="maxSelections"
          type="number"
          min="0"
          required
          defaultValue={value?.maxSelections ?? 1}
        />
        <AdminField
          label="Cota própria (opcional)"
          name="freeIncludedCount"
          type="number"
          min="0"
          defaultValue={value?.freeIncludedCount}
        />
        <AdminField
          label="Máximo por adicional"
          name="maxPerModifier"
          type="number"
          min="1"
          defaultValue={value?.maxPerModifier}
        />
        <AdminField
          label="Ordem"
          name="displayOrder"
          type="number"
          required
          defaultValue={value?.displayOrder ?? order}
        />
        <label className="block text-sm font-bold">
          Modo de preço
          <select
            name="pricingMode"
            defaultValue={value?.pricingMode ?? 'includedQuota'}
            className="mt-2 h-11 w-full rounded-xl border bg-[#f3f0e8] px-3 font-normal"
          >
            <option value="includedQuota">Cota incluída</option>
            <option value="individual">Individual</option>
          </select>
        </label>
      </div>
      <fieldset className="mt-4 rounded-2xl border border-[#070a08]/10 bg-[#f3f0e8] p-4">
        <legend className="px-1 text-sm font-black">Adicionais deste grupo</legend>
        <p className="mt-1 text-xs text-[#7b887d]">Selecione pelo nome os itens que o cliente poderá escolher.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {modifiers.map((modifier) => (
            <label key={modifier.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm font-bold">
              <span>{modifier.name}<small className="ml-2 font-normal text-[#7b887d]">{formatBRL(modifier.priceCents)}</small></span>
              <input type="checkbox" checked={selectedIds.includes(modifier.id)} onChange={(event) => onChange(event.target.checked ? [...selectedIds, modifier.id] : selectedIds.filter((id) => id !== modifier.id))} />
            </label>
          ))}
          {!modifiers.length && <p className="text-sm text-[#7b887d]">Cadastre um adicional antes de criar o grupo.</p>}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
        <label>
          <input
            type="checkbox"
            name="active"
            defaultChecked={value?.active ?? true}
          />{' '}
          Ativo
        </label>
        <label>
          <input
            type="checkbox"
            name="required"
            defaultChecked={value?.required}
          />{' '}
          Obrigatório
        </label>
        <label>
          <input
            type="checkbox"
            name="allowDuplicate"
            defaultChecked={value?.allowDuplicate}
          />{' '}
          Permite repetir
        </label>
      </div>
    </>
  );
}
