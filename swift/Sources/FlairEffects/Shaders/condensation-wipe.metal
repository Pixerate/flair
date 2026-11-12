// flair-metal-hash: e7f64b25
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float uFog;
    float uBlur;
    char _m15_pad[8];
    packed_float3 uFogColor;
    float uWidth;
    float uDroplets;
    float uDrips;
    float uRefog;
    uint uDemo;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_condensation_wipe_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 finger(thread const float& t, constant FlairUniforms& _130)
{
    float aspect = _130.iResolution[0u] / _130.iResolution[1u];
    return float2(aspect * (0.5 + (0.319999992847442626953125 * sin(t * 0.89999997615814208984375))), 0.5 + (0.25 * sin((t * 1.7000000476837158203125) + 0.60000002384185791015625)));
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.9999999392252902907785028219223e-09), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _130)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_130.uBackdrop) * _130.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_130.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _130)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _130.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _130);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _130, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _130.iResolution[1u];
    float2 p = fragCoord * px;
    float2 uv = fragCoord / float2(_130.iResolution[0], _130.iResolution[1]);
    float hover = fast::clamp(_130.iPointer.z, 0.0, 1.0);
    float clear = 0.0;
    if ((_130.uDemo != 0u) && (hover < 1.0))
    {
        for (int i = 0; i < 24; i++)
        {
            float age = float(i) / 24.0;
            float t0 = _130.iTime - (age * _130.uRefog);
            float param = t0;
            float param_1 = t0 - (_130.uRefog / 24.0);
            float2 param_2 = p;
            float2 param_3 = finger(param, _130);
            float2 param_4 = finger(param_1, _130);
            float d = segment(param_2, param_3, param_4);
            clear = fast::max(clear, (smoothstep(_130.uWidth * 0.5, _130.uWidth * 0.300000011920928955078125, d) * (1.0 - age)) * (1.0 - hover));
        }
    }
    for (int i_1 = 0; i_1 < 31; i_1++)
    {
        if (_130.iTrail[i_1 + 1].w < 0.5)
        {
            break;
        }
        float age_1 = fast::clamp(_130.iTime - _130.iTrail[i_1].z, 0.0, 1.0);
        float2 param_5 = p;
        float2 param_6 = _130.iTrail[i_1].xy * px;
        float2 param_7 = _130.iTrail[i_1 + 1].xy * px;
        float d_1 = segment(param_5, param_6, param_7);
        clear = fast::max(clear, smoothstep(_130.uWidth * 0.5, _130.uWidth * 0.300000011920928955078125, d_1) * (1.0 - (age_1 * age_1)));
    }
    clear = fast::max(clear, hover * smoothstep(_130.uWidth * 0.5, _130.uWidth * 0.300000011920928955078125, length(p - (_130.iPointer.xy * px))));
    float lane = floor(p.x / 0.07999999821186065673828125);
    float lx = (fract(p.x / 0.07999999821186065673828125) - 0.5) * 0.07999999821186065673828125;
    float2 param_8 = float2(lane, 3.0);
    float hasDrip = step(1.0 - (0.449999988079071044921875 * _130.uDrips), hash12(param_8));
    float2 param_9 = float2(lane, 7.0);
    float2 param_10 = float2(lane, 9.0);
    float head = 1.2000000476837158203125 - (fract((_130.iTime * (0.0500000007450580596923828125 + (0.07999999821186065673828125 * hash12(param_9)))) + hash12(param_10)) * 1.5);
    float wobble = 0.0040000001899898052215576171875 * sin((p.y * 40.0) + lane);
    float dripLine = (smoothstep(0.0040000001899898052215576171875, 0.00200000009499490261077880859375, abs(lx + wobble)) * step(head, p.y)) * smoothstep(head + 0.3499999940395355224609375, head, p.y);
    float drop = smoothstep(0.008000000379979610443115234375, 0.004999999888241291046142578125, length(float2(lx + wobble, (p.y - head) * 0.699999988079071044921875)));
    clear = fast::max(clear, fast::max(dripLine * 0.800000011920928955078125, drop) * hasDrip);
    float2 param_11 = uv;
    float param_12 = 1.0;
    float4 sharp = pictureBlurRGBA(uImage, uImageSmplr, param_11, param_12, _130);
    float2 param_13 = uv;
    float param_14 = 2.0 + (_130.uBlur * 40.0);
    float4 blurred = pictureBlurRGBA(uImage, uImageSmplr, param_13, param_14, _130);
    float3 fog = mix(blurred.xyz, float3(_130.uFogColor), float3(_130.uFog * 0.550000011920928955078125)) + float3(0.039999999105930328369140625 * _130.uFog);
    float2 cell = floor(p * 40.0);
    float2 param_15 = cell;
    float2 local = (fract(p * 40.0) - float2(0.5)) - ((hash22(param_15) - float2(0.5)) * 0.4000000059604644775390625);
    float2 param_16 = cell + float2(1.7000000476837158203125);
    float size = 0.100000001490116119384765625 + (0.25 * hash12(param_16));
    float2 param_17 = cell + float2(4.099999904632568359375);
    float droplet = (smoothstep(size, size - 0.0599999986588954925537109375, length(local)) * step(0.550000011920928955078125, hash12(param_17))) * _130.uDroplets;
    float2 param_18 = uv - (local * 0.0199999995529651641845703125);
    float param_19 = 1.0;
    float3 inDrop = mix(fog, pictureBlurRGBA(uImage, uImageSmplr, param_18, param_19, _130).xyz, float3(0.60000002384185791015625));
    inDrop += float3((0.25 * smoothstep(0.0, size, -(local.x - local.y))) - (0.07999999821186065673828125 * smoothstep(0.0, size, local.x - local.y)));
    fog = mix(fog, inDrop, float3(droplet * (1.0 - clear)));
    float ridge = (clear * (1.0 - clear)) * 4.0;
    float3 col = mix(fog, sharp.xyz, float3(clear));
    col += float3(ridge * 0.07999999821186065673828125);
    fragColor = float4(col, sharp.w);
}

fragment flair_condensation_wipe_frag_out flair_condensation_wipe_frag(constant FlairUniforms& _130 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_condensation_wipe_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _786;
    if (_130.flair_flipY > 0.5)
    {
        _786 = _130.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _786 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _786);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _130, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

