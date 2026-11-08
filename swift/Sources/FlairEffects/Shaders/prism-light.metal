// flair-metal-hash: 4e78d54c
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uBackground;
    packed_float3 uBeamColor;
    float uSize;
    float uSpread;
    float uTilt;
    float uWobble;
    float uSpeed;
    float uBeamAngle;
    float uHaze;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_prism_light_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float triangle(thread const float2& p, thread const float2& p0, thread const float2& p1, thread const float2& p2)
{
    float2 e0 = p1 - p0;
    float2 e1 = p2 - p1;
    float2 e2 = p0 - p2;
    float2 v0 = p - p0;
    float2 v1 = p - p1;
    float2 v2 = p - p2;
    float2 pq0 = v0 - (e0 * fast::clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0));
    float2 pq1 = v1 - (e1 * fast::clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0));
    float2 pq2 = v2 - (e2 * fast::clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0));
    float s = sign((e0.x * e2.y) - (e0.y * e2.x));
    float2 d = fast::min(fast::min(float2(dot(pq0, pq0), s * ((v0.x * e0.y) - (v0.y * e0.x))), float2(dot(pq1, pq1), s * ((v1.x * e1.y) - (v1.y * e1.x)))), float2(dot(pq2, pq2), s * ((v2.x * e2.y) - (v2.y * e2.x))));
    return (-sqrt(d.x)) * sign(d.y);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float3 spectrum(thread const float& x)
{
    float3 d = (float3(x) - float3(0.20000000298023223876953125, 0.5, 0.800000011920928955078125)) / float3(0.300000011920928955078125);
    float3 c = fast::clamp(float3(1.0) - (d * d), float3(0.0), float3(1.0));
    c.x += (0.3499999940395355224609375 * fast::clamp(1.0 - (((x - 0.949999988079071044921875) * (x - 0.949999988079071044921875)) / 0.022500000894069671630859375), 0.0, 1.0));
    return c;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _428)
{
    float px = 1.0 / _428.iResolution[1u];
    float2 p = (fragCoord - (float2(_428.iResolution[0], _428.iResolution[1]) * 0.5)) * px;
    float t = _428.iTime * _428.uSpeed;
    float ang = radians(_428.uTilt) + ((_428.uWobble * 0.180000007152557373046875) * sin(t));
    float param = ang;
    float2x2 turn = rot(param);
    float cr = _428.uSize / 1.7320499420166015625;
    float2 top = turn * float2(0.0, cr);
    float2 bl = turn * float2((-0.5) * _428.uSize, (-0.5) * cr);
    float2 br = turn * float2(0.5 * _428.uSize, (-0.5) * cr);
    float2 param_1 = p;
    float2 param_2 = top;
    float2 param_3 = bl;
    float2 param_4 = br;
    float sd = triangle(param_1, param_2, param_3, param_4);
    float2 enter = mix(top, bl, float2(0.550000011920928955078125));
    float2 leave = mix(top, br, float2(0.579999983310699462890625));
    float b = radians(_428.uBeamAngle);
    float2 dirIn = float2(cos(b), sin(b));
    float param_5 = (-0.4199999868869781494140625) - (1.60000002384185791015625 * ang);
    float2 dirOut = rot(param_5) * dirIn;
    float2 param_6 = (p * 3.0) + float2(t * 0.100000001490116119384765625, 0.0);
    int param_7 = 4;
    float _555 = fbm(param_6, param_7);
    float haze = _428.uHaze * (0.5 + (0.800000011920928955078125 * _555));
    float3 col = _428.uBackground;
    float2 param_8 = p;
    float2 param_9 = enter - (dirIn * 4.0);
    float2 param_10 = enter;
    float din = segment(param_8, param_9, param_10);
    col += (((float3(_428.uBeamColor) * ((exp((-din) / 0.0024999999441206455230712890625) * 0.89999997615814208984375) + ((exp((-din) / 0.02999999932944774627685546875) * 0.3499999940395355224609375) * haze))) * _428.uGlow) * step(0.0, sd + 0.00200000009499490261077880859375));
    float2 v = p - leave;
    float fwd = dot(v, dirOut);
    float side = (dirOut.x * v.y) - (dirOut.y * v.x);
    float x = (precise::atan2(side, fast::max(fwd, 9.9999997473787516355514526367188e-05)) / _428.uSpread) + 0.5;
    float inFan = ((smoothstep(0.0, 0.0599999986588954925537109375, x) * smoothstep(1.0, 0.939999997615814208984375, x)) * step(0.0, fwd)) * step(0.0, sd);
    float fade = (1.0 / (1.0 + (fwd * 1.5))) * smoothstep(0.0, 0.02999999932944774627685546875, fwd);
    float param_11 = 1.0 - fast::clamp(x, 0.0, 1.0);
    float3 fan = (spectrum(param_11) * inFan) * fade;
    col += ((fan * _428.uGlow) * (0.75 + (0.60000002384185791015625 * haze)));
    if (sd < 0.0040000001899898052215576171875)
    {
        float inside = smoothstep(1.5 * px, (-1.5) * px, sd);
        float2 w = p - enter;
        float2 across = leave - enter;
        float k = fast::clamp(dot(w, across) / dot(across, across), 0.0, 1.0);
        float2 param_12 = p;
        float2 param_13 = enter;
        float2 param_14 = leave;
        float dInt = segment(param_12, param_13, param_14);
        float spread = 0.0040000001899898052215576171875 + (0.0199999995529651641845703125 * k);
        float sideIn = ((across.x * w.y) - (across.y * w.x)) / length(across);
        float param_15 = fast::clamp(0.5 - (sideIn / (2.0 * spread)), 0.0, 1.0);
        float3 inner = (mix(float3(_428.uBeamColor), spectrum(param_15), float3(k)) * exp((-dInt) / spread)) * 0.800000011920928955078125;
        float3 body = ((_428.uBackground * 0.60000002384185791015625) + float3(0.02999999932944774627685546875, 0.0350000001490116119384765625, 0.04500000178813934326171875)) + float3(0.0500000007450580596923828125 * (0.5 + ((0.5 * p.y) / cr)));
        float3 glass = body + (inner * _428.uGlow);
        col = mix(col, glass, float3(inside));
    }
    col += (((float3(0.75, 0.800000011920928955078125, 0.89999997615814208984375) * exp((-abs(sd)) / (1.2000000476837158203125 * px))) * 0.5) + float3((exp((-abs(sd)) / 0.01200000010430812835693359375) * 0.0599999986588954925537109375) * haze));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _862;
    if (a > 0.0)
    {
        _862 = bg + (d / float3(a));
    }
    else
    {
        _862 = bg;
    }
    float3 fg = _862;
    float alpha = a + (opacity * (1.0 - a));
    float3 _884;
    if (alpha > 0.0)
    {
        _884 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _884 = bg;
    }
    float3 col = _884;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _428)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _428);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _428.uBackground;
    float param_4 = _428.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_prism_light_frag_out flair_prism_light_frag(constant FlairUniforms& _428 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_prism_light_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _942;
    if (_428.flair_flipY > 0.5)
    {
        _942 = _428.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _942 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _942);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _428);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

