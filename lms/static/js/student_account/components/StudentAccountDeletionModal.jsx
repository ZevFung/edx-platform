/* globals gettext */
/* eslint-disable react/no-danger */
import React from 'react';
import 'whatwg-fetch';
import PropTypes from 'prop-types';
import { Button, Modal, Icon, InputText, StatusAlert } from '@edx/paragon/static';
import StringUtils from 'edx-ui-toolkit/js/utils/string-utils';

class StudentAccountDeletionConfirmationModal extends React.Component {
  constructor(props) {
    super(props);

    this.closeConfirmationModal = this.closeConfirmationModal.bind(this);
    this.deleteAccount = this.deleteAccount.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.passwordFieldValidation = this.passwordFieldValidation.bind(this);
    this.state = {
      password: '',
      passwordSubmitted: false,
      isValid: true,
      validationMessage: '',
      accountQueuedForDeletion: false,
      responseError: false,
      responseErrorBody: {},
    };
  }

  closeConfirmationModal() {
    const { onClose } = this.props;

    onClose();
  }

  deleteAccount() {
    const { password } = this.state;

    this.setState({ passwordSubmitted: true });

    fetch('/accounts/verify_password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    }).then((response) => {
      if (response.ok) {
        return this.setState({
          accountQueuedForDeletion: true,
          responseError: false,
          responseErrorBody: {},
        });
      }
      return this.failedSubmission(response);
    }).catch(error => this.failedSubmission(error));
  }

  // TODO: hook into field validation somehow
  failedSubmission(error) {
    // Temp. hack for local dev - start
    const { password } = this.state;
    if (password === 'yes') {
      return this.setState({
        accountQueuedForDeletion: true,
        responseError: false,
        responseErrorBody: {},
      });
    }
    // Temp. hack for local dev - end

    const { status } = error;
    const title = status === 403 ? gettext('Password is incorrect') : gettext('Unable to delete account');
    const body = status === 403 ? gettext('Please re-enter your password.') : gettext('Sorry, there was an error trying to process your request. Please try again later.');

    this.setState({
      passwordSubmitted: false,
      responseError: true,
      isValid: false,
      validationMessage: title,
      validationErrorDetails: body,
    });
  }

  handleChange(value) {
    this.setState({ password: value });
  }

  passwordFieldValidation(value) {
    let feedback = { isValid: true };

    if (value.length < 1) {
      feedback = {
        isValid: false,
        validationMessage: gettext('A Password is required'),
      };
    }

    this.setState(feedback);
  }

  renderConfirmationModal() {
    const {
      isValid,
      password,
      passwordSubmitted,
      responseError,
      validationErrorDetails,
      validationMessage,
    } = this.state;
    const { onClose } = this.props;
    const loseAccessText = StringUtils.interpolate(
      gettext('You may also lose access to verified certificates and other program credentials like MicroMasters certificates. If you want to make a copy of these for your records before proceeding with deletion, follow the instructions for {htmlStart}printing or downloading a certificate{htmlEnd}.'),
      {
        htmlStart: '<a href="http://edx.readthedocs.io/projects/edx-guide-for-students/en/latest/SFD_certificates.html#printing-a-certificate" target="_blank">',
        htmlEnd: '</a>',
      },
    );

    return (
      <Modal
        title={gettext('Are you sure?')}
        renderHeaderCloseButton={false}
        onClose={onClose}
        aria-live="polite"
        open
        body={(
          <div>
            {responseError &&
              <StatusAlert
                dialog={(
                  <div className="modal-alert">
                    <div className="icon-wrapper">
                      <Icon className={['fa', 'fa-exclamation-circle']} />
                    </div>
                    <div className="alert-content">
                      <h3 className="alert-title">{ validationMessage }</h3>
                      <p>{ validationErrorDetails }</p>
                    </div>
                  </div>
                )}
                alertType="danger"
                dismissible={false}
                open
              />
            }

            <StatusAlert
              dialog={(
                <div className="modal-alert">
                  <div className="icon-wrapper">
                    <Icon className={['fa', 'fa-exclamation-triangle']} />
                  </div>
                  <div className="alert-content">
                    <h3 className="alert-title">{ gettext('You have selected “Delete my account.” Deletion of your account and personal data is permanent and cannot be undone. EdX will not be able to recover your account or the data that is deleted.') }</h3>
                    <p>{ gettext('If you proceed, you will be unable to use this account to take courses on the edX app, edx.org, or any other site hosted by edX. This includes access to edx.org from your employer’s or university’s system and access to private sites offered by MIT Open Learning, Wharton Online, and Harvard Medical School.') }</p>
                    <p dangerouslySetInnerHTML={{ __html: loseAccessText }} />
                  </div>
                </div>
              )}
              dismissible={false}
              open
            />
            <p className="next-steps">{ gettext('If you still wish to continue and delete your account, please enter your account password:') }</p>
            <InputText
              name="confirm-password"
              label="Password"
              type="password"
              className={['confirm-password-input']}
              onBlur={this.passwordFieldValidation}
              isValid={isValid}
              validationMessage={validationMessage}
              onChange={this.handleChange}
              autoComplete="new-password"
              themes={['danger']}
            />
          </div>
        )}
        closeText={gettext('Cancel')}
        buttons={[
          <Button
            label={gettext('Cancel')}
            onClick={this.closeConfirmationModal}
            className={["cancel-btn"]}
          />,
          <Button
            label={gettext('Yes, Delete')}
            onClick={this.deleteAccount}
            disabled={password.length === 0 || passwordSubmitted}
          />,
        ]}
      />
    );
  }

  renderSuccessModal() {
    const { onClose } = this.props;

    return (
      <Modal
        title={gettext('We\'re sorry to see you go! Your account will be deleted shortly.')}
        renderHeaderCloseButton={false}
        body={gettext('Account deletion, including removal from email lists, may take a few weeks to fully process through our system. If you want to opt-out of emails before then, please unsubscribe from the footer of any email.')}
        onClose={onClose}
        aria-live="polite"
        open
      />
    );
  }

  render() {
    const { accountQueuedForDeletion } = this.state;

    return accountQueuedForDeletion ? this.renderSuccessModal() : this.renderConfirmationModal();
  }
}

StudentAccountDeletionConfirmationModal.propTypes = {
  onClose: PropTypes.func,
};

StudentAccountDeletionConfirmationModal.defaultProps = {
  onClose: () => {},
};

export default StudentAccountDeletionConfirmationModal;
