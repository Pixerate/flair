// flair-metal-hash: b34cc7b6
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    packed_float3 uColor;
    int uCount;
    float uSpeed;
    float uLength;
    float uAngle;
    float uWidth;
    float uGap;
};

struct flair_meteors_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _97)
{
    float px = 1.0 / _97.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _97.iResolution[0u] * px;
    float ang = radians(_97.uAngle);
    float2 v = float2(-sin(ang), -cos(ang));
    float2 n = float2(-v.y, v.x);
    float4 al = float4(0.0, dot(float2(aspect, 0.0), v), dot(float2(0.0, 1.0), v), dot(float2(aspect, 1.0), v));
    float4 ac = float4(0.0, dot(float2(aspect, 0.0), n), dot(float2(0.0, 1.0), n), dot(float2(aspect, 1.0), n));
    float alMin = fast::min(fast::min(al.x, al.y), fast::min(al.z, al.w));
    float span = fast::max(fast::max(al.x, al.y), fast::max(al.z, al.w)) - alMin;
    float acMin = fast::min(fast::min(ac.x, ac.y), fast::min(ac.z, ac.w));
    float laneW = (fast::max(fast::max(ac.x, ac.y), fast::max(ac.z, ac.w)) - acMin) / float(_97.uCount);
    float along = dot(p, v);
    float across = dot(p, n) - acMin;
    float lane = floor(across / laneW);
    float2 param = float2(lane, 7.309999942779541015625);
    float2 h = hash22(param);
    float2 param_1 = float2(lane, 2.1700000762939453125);
    float h3 = hash12(param_1);
    float centre = ((lane + 0.20000000298023223876953125) + (0.60000002384185791015625 * h.x)) * laneW;
    float speed = _97.uSpeed * (0.60000002384185791015625 + (0.800000011920928955078125 * h.y));
    float cycle = ((span + (2.0 * _97.uLength)) / speed) * (1.0 + (_97.uGap * h3));
    float head = (alMin - (0.100000001490116119384765625 * _97.uLength)) + (mod(_97.iTime + (h.x * 37.0), cycle) * speed);
    float behind = (head - along) / _97.uLength;
    float d = abs((dot(p, n) - acMin) - centre) / px;
    float a = 0.0;
    if ((behind > (-0.0500000007450580596923828125)) && (behind < 1.0))
    {
        float wd = _97.uWidth * (1.0 - (0.60000002384185791015625 * fast::max(behind, 0.0)));
        float line = fast::clamp(((wd * 0.5) + 0.5) - d, 0.0, 1.0);
        float tail = powr(fast::clamp(1.0 - behind, 0.0, 1.0), 2.0) * smoothstep(-0.0500000007450580596923828125, 0.0, behind);
        a = line * tail;
    }
    float hd = length(float2((head - along) / px, d));
    float glow = (exp((-hd) / (_97.uWidth * 2.0)) * 0.89999997615814208984375) + (exp((-hd) / (_97.uWidth * 6.0)) * 0.25);
    float alpha = fast::clamp(a + glow, 0.0, 1.0);
    fragColor = float4(mix(float3(_97.uColor), float3(1.0), float3(fast::clamp(glow, 0.0, 1.0) * 0.5)), alpha);
}

fragment flair_meteors_frag_out flair_meteors_frag(constant FlairUniforms& _97 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_meteors_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _420;
    if (_97.flair_flipY > 0.5)
    {
        _420 = _97.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _420 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _420);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _97);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

