"use client";

import { deleteTitleRelationship, updateTitleRelationship } from "./actions";

type Relationship = {
  id: string;
  source_title_id: string;
  target_title_id: string;
  relationship_type: string;
};

const relationshipTypes = [
  ["adaptation", "Адаптация"], ["sequel", "Продолжение"], ["prequel", "Приквел"],
  ["spin_off", "Спин-офф"], ["remake", "Ремейк"], ["side_story", "Побочная история"],
  ["alternative_version", "Альтернативная версия"], ["same_universe", "Одна вселенная"],
];

export function RelationshipManager({
  relationships,
  titleNames,
}: {
  relationships: Relationship[];
  titleNames: Record<string, string>;
}) {
  if (!relationships.length) return <p className="mt-3 text-sm text-zinc-500">Связей пока нет.</p>;
  return (
    <ul className="mt-4 space-y-3">
      {relationships.map((relationship) => (
        <li key={relationship.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-3 text-sm font-medium">
            {titleNames[relationship.source_title_id] ?? "Удалённый тайтл"} → {titleNames[relationship.target_title_id] ?? "Удалённый тайтл"}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <form action={updateTitleRelationship} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="relationship_id" value={relationship.id}/>
              <select name="relationship_type" defaultValue={relationship.relationship_type} className="rounded-lg border border-white/10 bg-[#111119] px-3 py-2 text-sm">
                {relationshipTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="rounded-lg border border-white/15 px-3 py-2 text-sm">Сохранить</button>
            </form>
            <form action={deleteTitleRelationship} onSubmit={(event) => {
              if (!window.confirm("Удалить эту связь между тайтлами? Связанные тайтлы и их данные останутся.")) event.preventDefault();
            }}>
              <input type="hidden" name="relationship_id" value={relationship.id}/>
              <button className="rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-300">Удалить связь</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
