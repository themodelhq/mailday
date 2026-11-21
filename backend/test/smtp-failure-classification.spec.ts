import { classifySendError } from '../src/mail/mail.service';

describe('SMTP delivery failure classification', () => {
  it('treats SMTP 5xx responses as permanent failures', () => {
    expect(classifySendError({ responseCode: 550, code: 'EENVELOPE' })).toEqual({ errorCode: '550', retryable: false });
    expect(classifySendError({ responseCode: 554 })).toEqual({ errorCode: '554', retryable: false });
  });

  it('treats SMTP 4xx responses as temporary failures', () => {
    expect(classifySendError({ responseCode: 421, code: 'ECONNECTION' })).toEqual({ errorCode: '421', retryable: true });
    expect(classifySendError({ responseCode: 450 })).toEqual({ errorCode: '450', retryable: true });
  });

  it('treats authentication and envelope errors as permanent without an SMTP response', () => {
    expect(classifySendError({ code: 'EAUTH' })).toEqual({ errorCode: 'EAUTH', retryable: false });
    expect(classifySendError({ code: 'EENVELOPE' })).toEqual({ errorCode: 'EENVELOPE', retryable: false });
  });

  it('defaults unknown transport errors to retryable', () => {
    expect(classifySendError({ code: 'ECONNECTION' })).toEqual({ errorCode: 'ECONNECTION', retryable: true });
    expect(classifySendError(new Error('socket timeout'))).toEqual({ retryable: true });
  });
});
