import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {SiteHeader} from "@/components/site-header";
import {createClient} from "@/lib/supabase/server";
import {TitleWizard} from "./wizard";

export async function WizardPage({titleId}:{titleId?:string}){
 const db=await createClient(),{data:{user},error}=await db.auth.getUser();if(error||!user)redirect("/login?next=%2Fadmin%2Ftitles");if(user.app_metadata?.role!=="catalog_admin")notFound();
 const [genresRes,franchisesRes,titleRes]=await Promise.all([db.from("genres").select("id,name").order("name").limit(500),db.from("franchises").select("id,name,status").order("name").limit(500),titleId?db.from("titles").select("id,name,original_name,slug,content_type,franchise_id,release_year,description,cover_url,banner_url").eq("id",titleId).maybeSingle():Promise.resolve({data:null,error:null})]);
 if(genresRes.error||franchisesRes.error||titleRes.error||(titleId&&!titleRes.data))notFound();
 const genreRes=titleId?await db.from("title_genres").select("genre_id").eq("title_id",titleId):{data:[],error:null};if(genreRes.error)notFound();
 const title=titleRes.data;
 const initial={id:title?.id??null,name:title?.name??"",original_name:title?.original_name??"",slug:title?.slug??"",content_type:title?.content_type??"anime",franchise_id:title?.franchise_id??"",release_year:title?.release_year?String(title.release_year):"",description:title?.description??"",cover_url:title?.cover_url??"",banner_url:title?.banner_url??"",genre_ids:(genreRes.data??[]).map(x=>x.genre_id),save_as_draft:false};
 return <main className="min-h-screen bg-background text-white"><SiteHeader active="catalog"/><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin/titles" className="text-sm text-violet-300">← Редактор тайтлов</Link><h1 className="mt-4 text-3xl font-black">{title?"Редактировать тайтл":"Создать тайтл"}</h1><p className="mt-2 text-sm text-zinc-400">Изменения сохраняются в существующую запись и не создают дубликаты.</p><TitleWizard initial={initial} genres={genresRes.data??[]} franchises={franchisesRes.data??[]}/></div></main>;
}
