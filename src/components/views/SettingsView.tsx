import React, { useState } from 'react';
import type { User, UserProfile } from '../../types';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';
import { api } from '../../services/api';

interface SettingsViewProps {
  user: User | null;
  profile: UserProfile | null;
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  onAccountDeleted: () => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  profile,
  onUpdateProfile,
  onAccountDeleted,
  showToast,
}) => {
  // Profile form state
  const [title, setTitle] = useState(profile?.title || 'Senior Software Engineer');
  const [targetRole, setTargetRole] = useState(profile?.targetRole || 'Staff Full Stack Engineer');
  const [yearsOfExperience, setYearsOfExperience] = useState(profile?.yearsOfExperience || 5);
  const [location, setLocation] = useState(profile?.location || 'San Francisco, CA');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email verification manual token state
  const [showVerifyInput, setShowVerifyInput] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Password reset state
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await onUpdateProfile({
        title,
        targetRole,
        yearsOfExperience: Number(yearsOfExperience),
        location,
      });
      showToast('success', 'Profile and target career parameters updated.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verifyToken.trim()) {
      showToast('error', 'Please enter your verification token.');
      return;
    }
    setIsVerifying(true);
    try {
      await api.verifyEmail(verifyToken.trim());
      showToast('success', 'Email successfully verified! Full account capabilities activated.');
      setShowVerifyInput(false);
      setVerifyToken('');
    } catch (err: any) {
      showToast('error', err.message || 'Verification token invalid or expired.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!user?.email) return;
    setIsRequestingReset(true);
    try {
      const res = await api.forgotPassword(user.email);
      showToast('info', res.message || 'Password reset token generated.');
      if (res.resetToken) {
        setResetTokenInput(res.resetToken);
      }
      setShowResetModal(true);
    } catch (err: any) {
      showToast('error', err.message || 'Unable to request password reset.');
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTokenInput || !newPassword) {
      showToast('error', 'Please provide both token and new password.');
      return;
    }
    if (newPassword.length < 8) {
      showToast('error', 'New password must be at least 8 characters long.');
      return;
    }
    setIsResetting(true);
    try {
      await api.resetPassword(resetTokenInput.trim(), newPassword);
      showToast('success', 'Password reset successfully.');
      setShowResetModal(false);
      setNewPassword('');
      setResetTokenInput('');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reset password.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await api.deleteAccount();
      showToast('success', 'Account permanently deleted.');
      onAccountDeleted();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete account.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#171713] tracking-tight">Account & Security Settings</h1>
        <p className="text-sm text-[#6E6E63] mt-1">
          Manage your career target profile, email verification credentials, and cryptographic security.
        </p>
      </div>

      {/* Account Status Card */}
      <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] font-bold text-lg">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#171713]">{user?.name || 'Authorized Candidate'}</h2>
              <p className="text-xs text-[#6E6E63] flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Account
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Unverified Email
              </span>
            )}

            {user?.isDemo && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30">
                Demo Sandbox
              </span>
            )}
          </div>
        </div>

        {!user?.emailVerified && !user?.isDemo && (
          <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Email verification is pending.</p>
              <p className="text-amber-800/90 mt-0.5">
                Confirm your verification token to unlock persistent exports and team collaboration.
              </p>
            </div>
            <button
              onClick={() => setShowVerifyInput(!showVerifyInput)}
              className="px-3 py-1.5 rounded-md bg-amber-800 text-white font-medium hover:bg-amber-900 transition shrink-0"
            >
              Enter Token
            </button>
          </div>
        )}

        {showVerifyInput && (
          <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] space-y-3">
            <label className="block text-xs font-medium text-[#171713]">Email Verification Token</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="Paste the 64-character verification token..."
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
              />
              <button
                onClick={handleVerifyEmail}
                disabled={isVerifying}
                className="px-4 py-2 rounded-lg bg-[#4F5D2F] text-white text-xs font-medium hover:bg-[#37421F] disabled:opacity-50"
              >
                {isVerifying ? 'Verifying...' : 'Verify Email'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Target Career Profile Settings */}
      <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs">
        <h2 className="text-base font-semibold text-[#171713] mb-1">Career & Targeting Parameters</h2>
        <p className="text-xs text-[#6E6E63] mb-5">
          These parameters ground the ATS simulation and Career Gap Intelligence models.
        </p>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#171713] mb-1.5">Current Professional Title</label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-[#6E6E63] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#171713] mb-1.5">Target Desired Role</label>
              <div className="relative">
                <Sparkles className="w-4 h-4 text-[#C49A3A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#171713] mb-1.5">Years of Professional Experience</label>
              <div className="relative">
                <Clock className="w-4 h-4 text-[#6E6E63] absolute left-3 top-2.5" />
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#171713] mb-1.5">Location / Target Market</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#6E6E63] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 rounded-lg bg-[#4F5D2F] text-white text-xs font-medium hover:bg-[#37421F] disabled:opacity-50 transition shadow-xs"
            >
              {isSavingProfile ? 'Saving Changes...' : 'Save Career Parameters'}
            </button>
          </div>
        </form>
      </div>

      {/* Security & Authentication Card */}
      <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-4">
        <h2 className="text-base font-semibold text-[#171713]">Security & Credentials</h2>
        <p className="text-xs text-[#6E6E63]">
          ResumeX AI uses multi-factor cryptographic salt hashing with bcrypt (12 rounds) and HMAC-SHA256 tokens.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1]">
          <div>
            <h4 className="text-xs font-semibold text-[#171713] flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#4F5D2F]" />
              Password & Access Recovery
            </h4>
            <p className="text-xs text-[#6E6E63] mt-0.5">
              Generate a secure, single-use password reset token with immediate cryptographic validation.
            </p>
          </div>

          <button
            onClick={handleRequestPasswordReset}
            disabled={isRequestingReset}
            className="px-3.5 py-1.5 rounded-lg border border-[#D5D2C7] bg-white text-xs font-medium text-[#171713] hover:bg-[#FAF9F5] disabled:opacity-50 transition shrink-0"
          >
            {isRequestingReset ? 'Generating Token...' : 'Change / Reset Password'}
          </button>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-xs space-y-3">
        <h2 className="text-base font-semibold text-rose-700 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-600" />
          Danger Zone
        </h2>
        <p className="text-xs text-[#6E6E63]">
          Deleting your account permanently purges all resumes, ATS diagnostics, job matches, and version history.
        </p>

        <div className="pt-2">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition"
          >
            Delete Account Permanently
          </button>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-bold text-[#171713]">Reset Account Password</h3>
            <p className="text-xs text-[#6E6E63]">
              Enter the reset token along with your desired new password (minimum 8 characters).
            </p>

            <form onSubmit={handleConfirmPasswordReset} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#171713] mb-1">Reset Token</label>
                <input
                  type="text"
                  value={resetTokenInput}
                  onChange={(e) => setResetTokenInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D5D2C7] bg-white font-mono"
                  placeholder="Paste reset token..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#171713] mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D5D2C7] bg-white"
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#D5D2C7] text-xs font-medium text-[#6E6E63] hover:bg-[#FAF9F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-1.5 rounded-lg bg-[#4F5D2F] text-white text-xs font-medium hover:bg-[#37421F] disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Permanently Delete Account?"
        message="This action cannot be undone. All your resumes, ATS intelligence history, and personalized models will be purged immediately from the database."
        confirmText="Yes, Permanently Delete"
        isDanger={true}
        isLoading={isDeletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};
