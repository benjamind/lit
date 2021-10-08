/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {LitElement, html, TemplateResult} from 'lit';
import {property} from 'lit/decorators/property.js';
import {state} from 'lit/decorators/state.js';
import {cache} from 'lit/directives/cache.js';

import {ContextProvider, createContext, ContextCallback} from '../lit-context';
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
 * The "userId" field can be used to tell which component it is targeted for.
 * Sometimes, we already have list of "userId"s, but miss the rest of the data.
 */
interface IUserInfoContext {
  userId: string
  firstName: string
  lastName: string
  age: number
}

const userInfoContext = createContext<IUserInfoContext>('user-info');

class UserInfoContextProvider extends LitElement {
  private provider = new ContextProvider(this, userInfoContext);
  public setValue(value: IUserInfoContext) {
    this.provider.setValue(value);
  }
}

class UserInfoBadgeContextConsumer extends LitElement {
  @state()
  public age = 0;

  @state()
  public firstName = '';

  @state()
  public lastName = '';

  @property({type: String, attribute: 'data-user-id'})
  public readonly userId: string = ''

  public constructor() {
    super();
    new ContextConsumer(
      this,
      userInfoContext,
      this.onCallback,
      true // allow multiple values
    );
  }

  private onCallback: ContextCallback<IUserInfoContext> = (value: IUserInfoContext) => {
    const { userId = '', ...rest  } = value ?? {}
    // Use in payload "userId" property (name not important)
    // to help re-use same context object, yet target a destination
    if (this.userId === userId) {
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

customElements.define('user-info-badge-context-consumer', UserInfoBadgeContextConsumer);
customElements.define('user-info-context-provider', UserInfoContextProvider);

suite('context-provider when many consumer different identities', () => {
  let provider: UserInfoContextProvider;
  let consumers: NodeListOf<UserInfoBadgeContextConsumer>;

  const aliceUserId = 'alice'
  const aliceUserInfo: IUserInfoContext = Object.freeze({ userId: aliceUserId, firstName: 'Alice', lastName: 'Carroll', age: 41 })

  const bobUserId = 'bob'
  const bobUserInfo: IUserInfoContext = Object.freeze({ userId: bobUserId, firstName: 'Bob', lastName: 'Dylan', age: 40 })

  setup(async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <user-info-context-provider>
        <user-info-badge-context-consumer data-user-id="alice"></user-info-badge-context-consumer>
        <!-- many more ... -->
        <user-info-badge-context-consumer data-user-id="bob"></user-info-badge-context-consumer>
      </user-info-context-provider>
    `;
    document.body.appendChild(container);

    provider = container.querySelector(
      'user-info-context-provider'
    ) as UserInfoContextProvider;
    consumers = provider.querySelectorAll(
      'user-info-badge-context-consumer'
    ) as NodeListOf<UserInfoBadgeContextConsumer>;
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
    provider.setValue({ ...aliceUserInfo })
    provider.setValue({ ...bobUserInfo })
    const [alice, bob] = consumers
    assert.strictEqual(alice.firstName, 'Alice')
    assert.strictEqual(alice.lastName, 'Carroll')
    assert.strictEqual(bob.firstName, 'Bob')
    assert.strictEqual(bob.lastName, 'Dylan')
    await alice.updateComplete
    assert.equal(alice.shadowRoot!.textContent, 'Hi, my name is Alice Carroll, and I am 41');
  })
});