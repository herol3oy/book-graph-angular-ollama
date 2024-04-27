import { AsyncPipe, CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, Inject, Injectable, OnInit } from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import mermaid from 'mermaid';
import {
  Observable,
  debounceTime,
  finalize,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

interface Book {
  title: string;
  author_name: string[];
}

interface OpenLibraryResponse {
  docs: Book[];
}

interface Response {
  response: string;
}

interface BookGraph {
  id: string;
  bookName: string;
  svgGraph: SafeHtml;
}

@Injectable()
export class BookSearchService {
  constructor(private readonly http: HttpClient) {}

  searchBooks(query: string): Observable<Book[]> {
    return this.http
      .get<OpenLibraryResponse>(
        `https://openlibrary.org/search.json?title=${query}`
      )
      .pipe(map((response) => response.docs));
  }
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
  selector: 'app-home',
  standalone: true,
  styleUrl: 'home.component.scss',

  providers: [MermaidService, BookSearchService],
  imports: [
    CommonModule,
    HttpClientModule,
    RouterModule,
    MatButtonModule,
    MatLabel,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    AsyncPipe,
    MatCardModule,
    MatChipsModule,
  ],
  template: `
    <div class="container">
      <form class="form">
        <mat-form-field class="example-full-width">
          <mat-label>Type a book title</mat-label>
          <input
            type="text"
            matInput
            [formControl]="myControl"
            [matAutocomplete]="auto"
            name="bookTitle"
            required
          />
          <mat-autocomplete #auto="matAutocomplete">
            @for (option of filteredOptions; track option) {
            <mat-option [value]="option.title">
              {{ option.title }}

              <mat-chip-option color="accent">
                {{ option.author_name }}
              </mat-chip-option>
            </mat-option>
            } @if(!filteredOptions.length && !loading) {
            <mat-option> No Result! </mat-option>
            } @if(loading) {
            <mat-option> Loading... </mat-option>
            }
          </mat-autocomplete>
          @if (myControl.hasError('required')) {
          <mat-error>Book name is required</mat-error>

          } @if (myControl.hasError('minlength')) {
          <mat-error>Book title must be at least 4 characters long</mat-error>
          }
        </mat-form-field>
        <button
          class="graph-button"
          [disabled]="
            !myControl.value || myControl.invalid || !filteredOptions.length
          "
          mat-flat-button
          color="primary"
          (click)="displayGraph()"
        >
          Generate Graph
        </button>
      </form>
      <section class="graphs">
        @for (book of allBookGraphs; track book.id) {
        <mat-card class="example-card">
          <mat-card-header>
            <mat-card-title>{{ book.bookName }}</mat-card-title>
            <mat-card-subtitle>{{ 'book.authorName' }}</mat-card-subtitle>
          </mat-card-header>
          <pre class="mermaid" [innerHTML]="book.svgGraph"></pre>
          <mat-card-actions>
            <button
              mat-stroked-button
              color="accent"
              (click)="openDialog(book)"
            >
              Open
            </button>
          </mat-card-actions>
        </mat-card>

        } @empty {
        <h1>No graph found!</h1>
        }
      </section>
    </div>
  `,
})
export class HomeComponent implements OnInit {
  bookName = '';
  allBookGraphs: BookGraph[] = [];
  loading = false;
  myControl = new FormControl<string>('', [
    Validators.required,
    Validators.minLength(4),
  ]);
  options: string[] = [];
  filteredOptions: Book[] = [];

  constructor(
    private readonly mermaidService: MermaidService,
    private readonly sanitizer: DomSanitizer,
    private readonly bookSearchService: BookSearchService,
    public dialog: MatDialog
  ) {}

  ngOnInit(): void {
    mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });

    this.myControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(400),
        switchMap((value) => {
          if (!value || !this.myControl.valid) {
            return of([]);
          } else {
            this.loading = true;
            this.filteredOptions = []
            return this.bookSearchService.searchBooks(value).pipe(
              finalize(() => {
                this.loading = false;
              })
            );
          }
        })
      )
      .subscribe({
        next: (books) => {
          this.filteredOptions = books.map((book) => ({
            title: book.title,
            author_name: book.author_name,
          }));
        },
      });
  }

  openDialog(book: BookGraph) {
    this.dialog.open(DialogDataExampleDialog, {
      data: book,
      width: '700px',
      height: '500px',
    });
  }

  displayGraph() {
    this.mermaidService
      .getMermaidContent(this.myControl.value || '')
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
            bookName: this.myControl.value ? this.myControl.value : '',
            svgGraph: mermaidSyntax,
          });
        },
      });
  }
}

@Component({
  selector: 'dialog-data-example-dialog',

  template: `
    <h1 mat-dialog-title>{{ data.bookName }}</h1>
    <mat-dialog-content>
      <pre class="mermaid" [innerHTML]="data.svgGraph"></pre>
    </mat-dialog-content>
  `,
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent],
})
export class DialogDataExampleDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: BookGraph) {}
}
