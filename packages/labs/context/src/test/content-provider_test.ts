/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {LitElement, html, TemplateResult} from 'lit';
import {property} from 'lit/decorators/property.js';
import {state} from 'lit/decorators/state.js';
import {cache} from 'lit/directives/cache.js';

import {ContextProvider, createContext} from '../lit-context';
import {assert} from '@esm-bundle/chai';
import {ContextConsumer} from '../lib/controllers/context-consumer.js';

const simpleContext = createContext<number>('simple-context');

class SimpleContextProvider extends LitElement {
  private provider = new ContextProvider(this, simpleContext, 1000);

  public setValue(value: number) {
    this.provider.setValue(value);
  }
}

class MultipleContextConsumer extends LitElement {
  @property({type: Number})
  public value = 0;

  public constructor() {
    super();
    new ContextConsumer(
      this,
      simpleContext,
      (value) => {
        this.value = value;
      },
      true // allow multiple values
    );
  }

  protected render(): TemplateResult {
    return html`Value <span id="value">${this.value}</span>`;
  }
}

class OnceContextConsumer extends LitElement {
  @property({type: Number})
  public value = 0;

  public constructor() {
    super();
    new ContextConsumer(this, simpleContext, (value) => {
      this.value = value;
    });
  }

  protected render(): TemplateResult {
    return html`Value <span id="value">${this.value}</span>`;
  }
}

customElements.define('multiple-context-consumer', MultipleContextConsumer);
customElements.define('once-context-consumer', OnceContextConsumer);
customElements.define('simple-context-provider', SimpleContextProvider);

suite('context-provider', () => {
  let provider: SimpleContextProvider;
  let consumer: MultipleContextConsumer;

  setup(async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <simple-context-provider>
        <multiple-context-consumer></multiple-context-consumer>
      </simple-context-provider>
    `;
    document.body.appendChild(container);

    provider = container.querySelector(
      'simple-context-provider'
    ) as SimpleContextProvider;
    assert.isDefined(provider);
    consumer = provider.querySelector(
      'multiple-context-consumer'
    ) as MultipleContextConsumer;
    assert.isDefined(consumer);
  });

  test(`consumer receives a context`, async () => {
    assert.strictEqual(consumer.value, 1000);
  });

  test(`consumer receives updated context on provider change`, async () => {
    assert.strictEqual(consumer.value, 1000);
    provider.setValue(500);
    assert.strictEqual(consumer.value, 500);
  });

  test(`multiple consumers receive the same context`, async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <multiple-context-consumer>
      </multiple-context-consumer>
    `;
    provider.appendChild(container);
    const consumer2 = container.querySelector(
      'multiple-context-consumer'
    ) as MultipleContextConsumer;
    assert.isDefined(consumer2);

    assert.strictEqual(consumer.value, 1000);
    assert.strictEqual(consumer2.value, 1000);

    provider.setValue(500);
    assert.strictEqual(consumer.value, 500);
    assert.strictEqual(consumer2.value, 500);
  });
  test(`one-time consumers only receive context once`, async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <once-context-consumer>
      </once-context-consumer>
    `;
    provider.appendChild(container);
    const consumer2 = container.querySelector(
      'once-context-consumer'
    ) as OnceContextConsumer;
    assert.isDefined(consumer2);

    assert.strictEqual(consumer.value, 1000);
    assert.strictEqual(consumer2.value, 1000);

    provider.setValue(500);
    assert.strictEqual(consumer.value, 500);
    assert.strictEqual(consumer2.value, 1000); // one-time consumer still has old value
  });
});


/**
 * Say we have many components that has disperse data that would come from
 * many backends.
 * The "discriminant" here is known in advance, but the rest isn't.
 */
interface IContextWithDiscriminant {
  discriminant: string
  firstName: string
  lastName: string
  age: number
}

const withDiscriminantContext = createContext<IContextWithDiscriminant>('with-discriminant');

class WithDiscriminantProvider extends LitElement {
  private provider = new ContextProvider(this, withDiscriminantContext);

  public setValue(value: IContextWithDiscriminant) {
    this.provider.setValue(value);
  }
}

class WithDiscriminantContextConsumer extends LitElement {
  @state()
  public age = 0;

  @state()
  public firstName = '';

  @state()
  public lastName = '';

  @property({type: String, attribute: 'data-discriminant-id'})
  public readonly discriminant: string = ''

  public constructor() {
    super();
    new ContextConsumer(
      this,
      withDiscriminantContext,
      this.onCallback,
      true // allow multiple values
    );
  }

  private onCallback = (value: IContextWithDiscriminant) => {
    const { discriminant = '', ...rest  } = value ?? {}
    // Use in payload "discriminant" property (name not important)
    // to help re-use same context object, yet target a destination
    if (this.discriminant === discriminant) {
      const { firstName = '', lastName = '', age = 0 } = rest ?? {}
      this.firstName = firstName;
      this.lastName = lastName;
      this.age = age;
    }
  }

  protected render(): TemplateResult {
    const isNoLongerEmpty = ['firstName', 'lastName'].filter(k  => Reflect.get(this, k) !== '').length >= 2
    return html`Hi, ${cache(isNoLongerEmpty ?
      html`my name is <span id="firstName">${this.firstName}</span> <span id="lastName">${this.lastName}</span>, and I am <span id="age">${this.age}</span>` :
      html`sir`)}`;
  }
}

customElements.define('with-discriminant-context-consumer', WithDiscriminantContextConsumer);
customElements.define('with-discriminant-provider', WithDiscriminantProvider);

suite('context-provider when many consumer different identities', () => {
  let provider: WithDiscriminantProvider;
  let consumers: NodeListOf<WithDiscriminantContextConsumer>;

  setup(async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <with-discriminant-provider>
        <with-discriminant-context-consumer data-discriminant-id="alice"></with-discriminant-context-consumer>
        <with-discriminant-context-consumer data-discriminant-id="bob"></with-discriminant-context-consumer>
      </with-discriminant-provider>
    `;
    document.body.appendChild(container);

    provider = container.querySelector(
      'with-discriminant-provider'
    ) as WithDiscriminantProvider;
    consumers = provider.querySelectorAll(
      'with-discriminant-context-consumer'
    ) as NodeListOf<WithDiscriminantContextConsumer>;
    assert.isDefined(consumers);
    assert.lengthOf(consumers, 2);
    assert.isDefined(provider);
  });

  test(`alpha`, async () => {
    assert.strictEqual(consumers[0].firstName, '')
    assert.strictEqual(consumers[1].firstName, '')
    await consumers[1].updateComplete
    assert.equal(consumers[1].shadowRoot!.textContent, 'Hi, sir');
  })

  test(`bravo`, async () => {
    // Database data pulling, things happening, aggregating data.
    provider.setValue({ discriminant: 'alice', firstName: 'Alice', lastName: 'Carroll', age: 33 })
    provider.setValue({ discriminant: 'bob', firstName: 'Bob', lastName: 'Doe', age: 33 })
    const [alice, bob] = consumers
    assert.strictEqual(alice.firstName, 'Alice')
    assert.strictEqual(alice.lastName, 'Carroll')
    assert.strictEqual(bob.firstName, 'Bob')
    assert.strictEqual(bob.lastName, 'Doe')
    await alice.updateComplete
    assert.equal(alice.shadowRoot!.textContent, 'Hi, my name is Alice Carroll, and I am 33');
  })
});