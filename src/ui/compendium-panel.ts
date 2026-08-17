import { createCompendiumEntries, type CompendiumCategory, type CompendiumEntry } from "../systems/compendium-system";
import { bindItemIconFallbacks, createItemIconMarkup } from "./item-icon";

export interface CompendiumPanelState { developerMode: boolean; count(entry: CompendiumEntry): number }
export class CompendiumPanel {
  readonly root: HTMLElement;
  private readonly entries = createCompendiumEntries();
  private readonly cards = new Map<string, HTMLElement>();
  private readonly counts = new Map<string, HTMLElement>();
  private readonly grantButtons: HTMLButtonElement[] = [];
  private readonly resultCount: HTMLElement;
  private state?: CompendiumPanelState;
  private shownCount=0;

  constructor(parent: HTMLElement, onBack: () => void, onGrant: (entry: CompendiumEntry) => void) {
    this.root = document.createElement("section"); this.root.className = "compendium-panel pixel-panel"; this.root.hidden = true;
    this.root.innerHTML = `<header><h2>아이템 도감</h2><button data-action="back">뒤로 [ESC]</button></header><div class="compendium-tools"><input type="search" placeholder="이름 검색" aria-label="아이템 이름 검색"><select aria-label="카테고리"><option value="all">전체</option></select><span></span></div><div class="compendium-grid"></div>`;
    const select = this.root.querySelector("select")!; const categories = [...new Set(this.entries.map((entry) => entry.category))];
    for (const category of categories) { const option=document.createElement("option"); option.value=category; option.textContent=categoryLabel(category); select.append(option); }
    const grid=this.root.querySelector<HTMLElement>(".compendium-grid")!; const fragment=document.createDocumentFragment();
    for (const entry of this.entries) {
      const card=document.createElement("article"); card.className="compendium-entry"; card.dataset.category=entry.category; card.dataset.search=`${entry.name} ${entry.description}`.toLocaleLowerCase("ko");
      card.innerHTML=`${createItemIconMarkup({id:entry.sourceId,name:entry.name,color:entry.color,className:"compendium-icon",path:entry.iconPath})}<div><b>${entry.name}</b><small>${categoryLabel(entry.category)} · ${entry.kind === "weapon" ? "장비" : `최대 ${entry.maxStack}`}</small><p>${entry.description}</p><em>보유 <span>0</span></em></div><button data-grant="${entry.id}">획득</button>`;
      this.cards.set(entry.id,card); this.counts.set(entry.id,card.querySelector("em span")!); this.grantButtons.push(card.querySelector("button")!); fragment.append(card);
    }
    grid.append(fragment);bindItemIconFallbacks(grid); this.resultCount=this.root.querySelector(".compendium-tools span")!;
    const apply=()=>this.applyFilter((this.root.querySelector("input") as HTMLInputElement).value,select.value as CompendiumCategory|"all");
    this.root.querySelector("input")!.addEventListener("input",apply); select.addEventListener("change",apply);
    this.root.addEventListener("click",(event)=>{ const button=(event.target as HTMLElement).closest<HTMLButtonElement>("button"); if(button?.dataset.action==="back") onBack(); const id=button?.dataset.grant; if(id){const entry=this.entries.find((candidate)=>candidate.id===id); if(entry) onGrant(entry);} });
    parent.append(this.root); this.applyFilter("","all");
  }
  show(state: CompendiumPanelState): void { this.state=state; this.root.hidden=false; this.refresh(state); }
  hide(): void { this.root.hidden=true; }
  refresh(state=this.state): void { if(!state)return; this.state=state; for(const entry of this.entries)this.counts.get(entry.id)!.textContent=String(state.count(entry)); for(const button of this.grantButtons){button.hidden=!state.developerMode;button.disabled=!state.developerMode;} this.root.classList.toggle("is-developer",state.developerMode);this.updateSummary(); }
  private applyFilter(query:string,category:CompendiumCategory|"all"):void{const normalized=query.trim().toLocaleLowerCase("ko");let shown=0;for(const entry of this.entries){const card=this.cards.get(entry.id)!;const visible=(category==="all"||entry.category===category)&&(!normalized||card.dataset.search!.includes(normalized));card.hidden=!visible;if(visible)shown++;}this.shownCount=shown;this.updateSummary();}
  private updateSummary():void{this.resultCount.textContent=`${this.shownCount}/${this.entries.length}개 · 개발자 ${this.state?.developerMode?"켜짐":"꺼짐"}`;}
}
function categoryLabel(category:CompendiumCategory):string{return ({food:"음식",medical:"치료",material:"재료",ammo:"탄약",tool:"제작·설치",quest:"목표 부품",weapon:"무기"} as Record<CompendiumCategory,string>)[category];}
