// flair-metal-hash: 68825c6d
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
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
    float uLines;
    float uClear;
    float uThickness;
    float uRate;
    uint uFollow;
    float3 uInk;
    packed_float3 uPaper;
    float uPaperAlpha;
};

struct flair_focus_lines_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _97)
{
    float2 middle = float2(_97.iResolution[0], _97.iResolution[1]) * 0.5;
    float _111;
    if (_97.uFollow != 0u)
    {
        _111 = fast::clamp(_97.iPointer.z, 0.0, 1.0);
    }
    else
    {
        _111 = 0.0;
    }
    float hover = _111;
    float2 centre = mix(middle, _97.iPointer.xy, float2(hover));
    float2 d = fragCoord - centre;
    float rpx = length(d);
    float r = length(d / (float2(_97.iResolution[0], _97.iResolution[1]) * 0.5));
    float frame = floor(_97.iTime * _97.uRate);
    float a = (precise::atan2(d.y, d.x) / 6.28318023681640625) + 0.5;
    float2 param = float2(frame, 7.0);
    float s = (a * _97.uLines) + (hash12(param) * 0.60000002384185791015625);
    float cell = mod(floor(s), _97.uLines);
    float2 param_1 = float2(cell, (frame * 1.37000000476837158203125) + 3.0);
    float2 h = hash22(param_1);
    float2 param_2 = float2((cell * 1.7000000476837158203125) + 2.0, frame);
    float h3 = hash12(param_2);
    float present = step(0.180000007152557373046875, h.x);
    float start = _97.uClear * (0.85000002384185791015625 + (0.449999988079071044921875 * h.y));
    float grow = smoothstep(start, (start + 0.3499999940395355224609375) + (0.4000000059604644775390625 * h3), r);
    float halfWidth = ((0.5 * _97.uThickness) * (0.3499999940395355224609375 + (0.64999997615814208984375 * h3))) * grow;
    float across = (((abs(fract(s) - 0.5) - halfWidth) * rpx) * 6.28318023681640625) / _97.uLines;
    float cover = (present * step(start, r)) * fast::clamp(0.5 - across, 0.0, 1.0);
    float4 acc = float4(float3(_97.uPaper) * _97.uPaperAlpha, _97.uPaperAlpha);
    acc = float4((acc.xyz * (1.0 - cover)) + (_97.uInk * cover), (acc.w * (1.0 - cover)) + cover);
    fragColor = float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

fragment flair_focus_lines_frag_out flair_focus_lines_frag(constant FlairUniforms& _97 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_focus_lines_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _330;
    if (_97.flair_flipY > 0.5)
    {
        _330 = _97.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _330 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _330);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _97);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

