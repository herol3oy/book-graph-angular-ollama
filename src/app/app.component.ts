import { Component, Injectable, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable, map, switchMap } from 'rxjs';
import mermaid from 'mermaid';
import { RouterModule } from '@angular/router';

interface Response {
  response: string;
}

interface BookGraph {
  id: string;
  bookName: string;
  svgGraph: SafeHtml;
}

@Injectable()
export class MermaidService {
  constructor(private readonly http: HttpClient) {}

  getMermaidContent(bookName: string): Observable<Response> {
    return this.http.post<Response>('http://localhost:11434/api/generate', {
      model: 'llama3:8b',
      prompt: bookName,
      stream: false,
      system: `
      You're a bookworm and an assistant. You'll provide the name of a book,
      and you will create a graph for its characters using Mermaid js syntax. 
      You can find the following as a sample for the book "The Wonderful Wizard of Oz". 
      Please refrain from including any explanations or descriptions at the beginning or end and 
      avoid adding notes or anything else and simply provide the syntax. 
      Do not include syntax highlighting for the syntax.

        graph TD
          A[Dorothy Gale] -->|Pet| B[Toto]
          A -->|Family| C[Uncle Henry and Aunt Em]
          A -->|Friends| D[Scarecrow]
          A -->|Friends| E[Tin Woodman]
          A -->|Friends| F[Cowardly Lion]
          A -->|Enemy| G[The Wicked Witch of The West]
          A -->|Enemy| H[The Wizard of OZ]
          A -->|Helps Dorothy| I[Glinda]
          D -->|Friends| E
          E -->|Friends| F
          B -->|In Kansas| C
      `,
    });
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  providers: [MermaidService],
  imports: [CommonModule, HttpClientModule, FormsModule,RouterModule],
  template: `
    @for (book of allBookGraphs; track book.id) {
    <li>{{ book.bookName }}</li>
    <pre class="mermaid" [innerHTML]="book.svgGraph"></pre>

    } @empty {
    <li>There are no items.</li>
    }

    <input type="text" [(ngModel)]="bookName" name="name" required />
    <button (click)="displayGraph()">Display Graph</button>
    <router-outlet></router-outlet>            

  `,
})
export class AppComponent implements OnInit {
  bookName = '';
  allBookGraphs: BookGraph[] = [];

  constructor(
    private readonly mermaidService: MermaidService,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });
  }

  displayGraph() {
    this.mermaidService
      .getMermaidContent(this.bookName)
      .pipe(
        switchMap((content) => {
          return mermaid.render(
            'graph_' + Math.random().toString(36).substring(2, 15),
            content.response
          );
        }),
        map(({ svg }) => {
          return this.sanitizer.bypassSecurityTrustHtml(svg);
        })
      )
      .subscribe({
        next: (mermaidSyntax) => {
          this.allBookGraphs.push({
            id: crypto.randomUUID(),
            bookName: this.bookName,
            svgGraph: mermaidSyntax,
          });
        },
      });
  }
}
